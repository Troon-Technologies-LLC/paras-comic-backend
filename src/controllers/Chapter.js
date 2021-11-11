const AsyncRetry = require('async-retry')
const slug = require('slug')

class Chapter {
  constructor({ database, storage, near }) {
    this.chapterDb = database.root.collection('chapters')
    this.storage = storage
    this.near = near
  }

  async find(query = {}, skip = 0, limit = 10) {
    try {
      const aggregationMatches = []

      if (query.comicId) {
        aggregationMatches.push({
          $match: {
            'metadata.comic_id': query.comicId,
          },
        })
      }

      if (query.chapterId) {
        aggregationMatches.push({
          $match: {
            'metadata.chapter_id': parseInt(query.chapterId),
          },
        })
      }

      if (query.tokenSeriesId) {
        aggregationMatches.push({
          $match: {
            'token_series_id': query.tokenSeriesId,
          },
        })
      }

      if (query.chapterIds) {
        aggregationMatches.push({
          $match: {
            'metadata.chapter_id': {
              $in: query.chapterIds.map((id) => parseInt(id)),
            },
          },
        })
      }

      aggregationMatches.push({
        $addFields: {
          status: 'buy',
        },
      })

      if (query.authAccountId) {
        aggregationMatches.push({
          $lookup: {
            from: 'access',
            let: {
              chapter_comic_id: '$metadata.comic_id',
              chapter_chapter_id: '$metadata.chapter_id',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$account_id', query.authAccountId] },
                      { $eq: ['$comic_id', '$$chapter_comic_id'] },
                      { $eq: ['$chapter_id', '$$chapter_chapter_id'] },
                    ],
                  },
                },
              },
            ],
            as: 'my_access',
          },
        })
        aggregationMatches.push({
          $addFields: {
            my_access: {
              $ifNull: [
                { $arrayElemAt: ['$my_access', 0] },
                { access_tokens: [] },
              ],
            },
          },
        })
        aggregationMatches.push({
          $addFields: {
            status: {
              $cond: {
                if: {
                  $gt: [{ $size: '$my_access.access_tokens' }, 0],
                },
                then: 'read',
                else: 'buy',
              },
            },
          },
        })
      }

      const aggregationFull = aggregationMatches.concat([
        {
          $project: {
            _id: 0,
            my_access: 0,
          },
        },
        {
          $sort: {
            chapter_id: 1,
            edition_id: 1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ])

      const rawResults = await this.chapterDb.aggregate(aggregationFull)

      const results = await rawResults.toArray()
      return results
    } catch (err) {
      throw err
    }
  }

  async addLanguage({ chapterId, comicId, lang, pageCount }, { dbSession }) {
    const key = `lang.${lang}`

    await this.chapterDb.updateMany(
      {
        'metadata.chapter_id': chapterId,
        'metadata.comic_id': comicId,
      },
      {
        $set: {
          [key]: pageCount,
        },
      },
      {
        session: dbSession,
      }
    )
    return true
  }

  async removeLanguage({ chapterId, comicId, lang }, { dbSession }) {
    const key = `lang.${lang}`

    await this.chapterDb.deleteMany(
      {
        'metadata.chapter_id': chapterId,
        'metadata.comic_id': comicId,
      },
      {
        $unset: {
          [key]: null,
        },
      },
      {
        session: dbSession,
      }
    )
    return true
  }

  async create({
    title,
    price,
    comicId,
    chapterId,
    media,
    description,
    blurhash,
    authorIds,
    collection,
    subtitle,
    copies,
    royalty
  }) {
    try {
      const metadata = {
        comic_id: comicId,
        chapter_id: chapterId,
        description: description,
        blurhash: blurhash,
        creator_id: authorIds[0],
        author_ids: authorIds,
        collection: collection,
        collection_id: slug(collection),
        subtitle: subtitle,
        issued_at: new Date().toISOString(),
      }

      // reference
      const reference = await this.storage.upload(
        JSON.stringify(metadata),
        'json',
        true
      )

      const tokenMetadata = {
        title: title,
        media: media,
        reference: reference,
      }

      if (copies) {
        tokenMetadata.copies = parseInt(copies)
      }

      const params = {
        token_metadata: tokenMetadata,
        price: price,
        royalty: null,
        creator_id: metadata.creator_id,
      }

      if (royalty) {
        params.royalty = {
          [metadata.creator_id]: parseInt(royalty) * 100
        }
      }

      const rawResult = await AsyncRetry(
        async () => {
          console.log('creating nft')
          try {

            return await this.near.functionCall(
              process.env.OWNER_ACCOUNT_ID,
              process.env.CONTRACT_ACCOUNT_ID,
              'nft_create_series',
              params,
              this.near.DEFAULT_GAS,
              '0.1'
            )
          } catch (err) {
            console.log(err)
            throw new Error('try again')
          }
        },
        {
          retries: 100,
          minTimeout: 500,
          maxTimeout: 1000,
        }
      )

      const result = JSON.parse(
        Buffer.from(rawResult.status.SuccessValue, 'base64').toString()
      )

      await this.chapterDb.insertOne({
        token_series_id: result.token_series_id,
        metadata: {
          ...tokenMetadata,
          ...metadata,
        },
        price: price,
      })

      return params
    } catch (err) {
      throw err
    }
  }
}

module.exports = Chapter

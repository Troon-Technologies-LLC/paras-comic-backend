const AsyncRetry = require('async-retry')
const slug = require('slug')

class TokenSeriesCtl {
  constructor({ database, storage, near }) {
    this.tokenSeriesDb = database.root.collection('token_series')
    this.storage = storage
    this.near = near
  }

  async find(query = {}, skip = 0, limit = 10) {
    try {
      let aggregationMatches = []

      if (query.comicId) {
        aggregationMatches.push({
          $match: {
            comic_id: query.comicId,
          },
        })
      }

      if (query.tokenSeriesId) {
        aggregationMatches.push({
          $match: {
            token_series_id: query.tokenSeriesId,
          },
        })
      }

      if (query.category === 'chapter') {
        aggregationMatches.push({
          $match: {
            'metadata.chapter_id': { $exists: true },
            'metadata.comic_id': { $exists: true },
          },
        })
      }

      if (query.category === 'collectible') {
        aggregationMatches.push({
          $match: {
            'metadata.chapter_id': { $exists: false },
            'metadata.comic_id': { $exists: true },
          },
        })
      }

      aggregationMatches = aggregationMatches.concat([
        {
          $project: {
            _id: 0,
          },
        },
        {
          $sort: {
            'metadata.issued_at': -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ])

      aggregationMatches.push({
        $set: {
          price: { $toString: '$price' }
        }
      })

      const rawResults = await this.tokenSeriesDb.aggregate(aggregationMatches)

      const results = await rawResults.toArray()
      return results
    } catch (err) {
      throw err
    }
  }

  async create({
    title,
    price,
    media,
    description,
    blurhash,
    creatorId,
    collection,
    copies,
    royalty
  }) {
    try {
      const metadata = {
        description: description,
        blurhash: blurhash,
        creator_id: creatorId,
        collection: collection,
        collection_id: slug(collection),
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

      return result
    } catch (err) {
      throw err
    }
  }
}

module.exports = TokenSeriesCtl

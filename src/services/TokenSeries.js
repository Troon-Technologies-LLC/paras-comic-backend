const { encodeImageToBlurhash } = require('../utils/common')
const { tokenSeriesCreate } = require('../utils/validator')

class TokenSeriesSvc {
  constructor({ tokenSeriesCtl }) {
    this.tokenSeriesCtl = tokenSeriesCtl
  }

  async find(query = {}, skip = 0, limit = 10) {
    try {
      const results = await this.tokenSeriesCtl.find(query, skip, limit)
      return {
        results: results,
        skip: skip,
        limit: 0,
      }
    } catch (err) {
      throw err
    }
  }

  async create(input) {
    try {
      console.log(input)
      await tokenSeriesCreate.validate(input, {
        abortEarly: true,
      })

      const blurhash = await encodeImageToBlurhash(
        `https://ipfs.fleek.co/ipfs/${input.media}`
      )

      const result = await this.tokenSeriesCtl.create({
        comicId: input.comic_id,
        title: input.title,
        price: input.price,
        media: input.media,
        copies: input.copies,
        royalty: input.royalty,
        description: input.description,
        creatorId: input.creator_id,
        collection: input.collection,
        blurhash: blurhash,
      })

      return result
    } catch (err) {
      throw err
    }
  }
}

module.exports = TokenSeriesSvc

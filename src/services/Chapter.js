const { chapterCreate } = require('../utils/validator')
const { encodeImageToBlurhash } = require('../utils/common')

class ChapterSvc {
  constructor({ chapterCtl, comicCtl, pageCtl }, { dbSession }) {
    this.chapterCtl = chapterCtl
    this.comicCtl = comicCtl
    this.pageCtl = pageCtl
    this.dbSession = dbSession
  }

  async find(query = {}, skip = 0, limit = 10) {
    try {
      const results = await this.chapterCtl.find(query, skip, limit)

      return {
        results: results,
        skip: skip,
        limit: limit,
      }
    } catch (err) {
      throw err
    }
  }

  async create(input) {
    try {
      await chapterCreate.validate(input, {
        abortEarly: true,
      })

      const comicId = input.comic_id
      const getComics = await this.comicCtl.find({
        comicId: comicId,
      })
      if (getComics.length === 0) {
        throw new Error('Comic not found')
      }
      const chapterId = input.chapter_id
      const getChapters = await this.chapterCtl.find({
        comicId: comicId,
        chapterId: chapterId,
      })
      if (input.force !== 'true' && getChapters.length > 0) {
        throw new Error('Chapter already exists')
      }
      const tokenType = `${comicId}-${chapterId}`
      const price = input.price || null
      let title = `${getComics[0].title} Ch.${parseInt(chapterId)}`
      if (input.subtitle) {
        title = `${title} : ${input.subtitle} `
      }
      const media = input.media
      const blurhash = await encodeImageToBlurhash(
        `https://ipfs.fleek.co/ipfs/${media}`
      )

      await this.dbSession.startTransaction()
      this.inTx = true

      const result = await this.chapterCtl.create({
        tokenType: tokenType,
        title: title,
        price: price,
        comicId: comicId,
        chapterId: chapterId,
        media: media,
        blurhash: blurhash,
        description: input.description,
        authorIds: input.author_ids,
        collection: input.collection,
        subtitle: input.subtitle,
        copies: input.copies
      })

      await this.dbSession.commitTransaction()

      this.inTx = false

      return result
    } catch (err) {
      if (this.inTx) {
        await this.dbSession.abortTransaction()
      }
      throw err
    }
  }
}

module.exports = ChapterSvc

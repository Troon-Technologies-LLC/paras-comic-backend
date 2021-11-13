const { chapterPageCreate } = require('../utils/validator')
class PageSvc {
  constructor({ comicCtl, chapterCtl, pageCtl }, { dbSession }) {
    this.comicCtl = comicCtl
    this.chapterCtl = chapterCtl
    this.pageCtl = pageCtl
    this.dbSession = dbSession
  }

  async getContent({ comicId, chapterId, pageId, lang, authAccountId }) {
    try {
      return await this.pageCtl.getContent({
        comicId,
        chapterId,
        pageId,
        lang,
        authAccountId,
      })
    } catch (err) {
      throw err
    }
  }

  async createBulk(input) {
    try {
      await chapterPageCreate.validate(input, {
        abortEarly: true,
      })

      const comicId = input.comic_id
      const lang = input.lang
      const pageCount = input.images.length

      const getComics = await this.comicCtl.find({
        comicId: comicId,
      })
      if (getComics.length === 0) {
        throw new Error('Comic not found')
      }
      const chapterId = input.chapter_id

      const getChapters = await this.chapterCtl.find({
        comic_id: comicId,
        chapter_id: chapterId,
      })
      if (getChapters.length === 0) {
        throw new Error('Chapter not found')
      }

      await this.dbSession.startTransaction()
      this.inTx = true

      // update chapter available lang
      await this.chapterCtl.addLanguage(
        {
          comicId,
          chapterId,
          lang,
          pageCount,
        },
        { dbSession: this.dbSession }
      )

      // create chapter pages
      await this.pageCtl.createBulk(
        {
          comicId,
          chapterId,
          lang,
          contentList: input.images,
        },
        { dbSession: this.dbSession }
      )

      await this.dbSession.commitTransaction()
      this.inTx = false

      return input
    } catch (err) {
      console.log(err)
      if (this.inTx) {
        await this.dbSession.abortTransaction()
      }
      throw err
    }
  }
}

module.exports = PageSvc

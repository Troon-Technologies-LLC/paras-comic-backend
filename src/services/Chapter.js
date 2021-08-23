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

	async create(input, files) {
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
			const chapterId = parseInt(input.chapter_id)
			const getChapters = await this.chapterCtl.find({
				comicId: comicId,
				chapterId: chapterId,
			})
			if (getChapters.length > 0) {
				throw new Error('Chapter already exists')
			}
			const tokenType = `${comicId}-${chapterId}`
			const price = input.price
			const title = `${getComics[0].title} Ch.${chapterId} : ${input.subtitle}`
			const coverFile = files.shift()

			await this.dbSession.startTransaction()
			this.inTx = true

			// create chapter pages
			await this.pageCtl.createBulk(
				{
					comicId,
					chapterId,
					contentList: files,
				},
				{ dbSession: this.dbSession }
			)

			const result = await this.chapterCtl.create({
				tokenType: tokenType,
				title: title,
				price: price,
				comicId: comicId,
				chapterId: chapterId,
				coverFile: coverFile,
				blurhash: await encodeImageToBlurhash(coverFile.path),
				description: input.description,
				authorIds: input.author_ids,
				pageCount: files.length,
				collection: input.collection,
				subtitle: input.subtitle,
			})
			await this.dbSession.commitTransaction()

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

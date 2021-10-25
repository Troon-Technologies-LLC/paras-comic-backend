var promiseLimit = require('promise-limit')

var limit = promiseLimit(6)

class Page {
	constructor({ database, storage }) {
		this.pageDb = database.root.collection('pages')
		this.accessDb = database.root.collection('access')
		this.cache = database.cache
		this.storage = storage
	}

	async createBulk({ comicId, chapterId, contentList, lang }, { dbSession }) {
		const contentHashList = contentList

		const pageList = contentHashList.map((content, idx) => ({
			comic_id: comicId,
			chapter_id: parseInt(chapterId),
			page_id: idx + 1,
			content: content,
			lang: lang,
		}))

		await this.pageDb.deleteMany(
			{
				comic_id: comicId,
				chapter_id: parseInt(chapterId),
				lang: lang,
			},
			{
				session: dbSession,
			}
		)

		const result = await this.pageDb.insertMany(pageList, {
			session: dbSession,
		})

		return result
	}

	async getContent({ comicId, chapterId, pageId, lang, authAccountId }) {
		const key = `${comicId}::${chapterId}::${pageId}::${lang}::${authAccountId}`
		try {
			const cacheExist = await this.cache.get(key)
			if (cacheExist) {
				return cacheExist
			}

			const query = {
				comic_id: comicId,
				chapter_id: parseInt(chapterId),
				page_id: parseInt(pageId),
			}

			if (lang) {
				query.lang = lang
			}

			const pageData = await this.pageDb.findOne(query)
			if (!pageData) {
				throw new Error(`page not found`)
			}
			const accessData = await this.accessDb.findOne({
				comic_id: comicId,
				chapter_id: parseInt(chapterId),
				account_id: authAccountId,
			})
			if (
				!accessData ||
				(accessData && accessData.access_tokens.length === 0)
			) {
				throw new Error(`unauthorized`)
			}

			if (pageData.content.includes('://')) {
				await this.cache.set(key, pageData.content)
				return pageData.content
			}

			// use cdn
			const url = `https://cdn.paras.id/${pageData.content}`
			// const url = `https://ipfs.fleek.co/ipfs/${pageData.content}`
			await this.cache.set(key, url)
			return url
		} catch (err) {
			throw err
		}
	}
}

module.exports = Page

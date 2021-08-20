class Page {
	constructor({ database, storage }) {
		this.pageDb = database.root.collection('pages')
		this.accessDb = database.root.collection('access')
		this.cache = database.cache
		this.storage = storage
	}

	async createBulk({ comicId, chapterId, contentList }) {
		const contentHashList = await Promise.all(
			contentList.map((file) => this.storage.upload(file, 'file', true))
		)

		const pageList = contentHashList.map((content, idx) => ({
			comic_id: comicId,
			chapter_id: parseInt(chapterId),
			page_id: idx + 1,
			content: content,
		}))

		const result = await this.pageDb.insertMany(pageList)

		return result
	}

	async getContent({ comicId, chapterId, pageId, authAccountId }) {
		const key = `${comicId}::${chapterId}::${pageId}::${authAccountId}`
		try {
			const cacheExist = await this.cache.get(key)
			if (cacheExist) {
				return cacheExist
			}

			const pageData = await this.pageDb.findOne({
				comic_id: comicId,
				chapter_id: parseInt(chapterId),
				page_id: parseInt(pageId),
			})
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

			await this.cache.set(key, pageData.content)
			if (pageData.content.includes('://')) {
				return pageData.content
			}

			return `https://ipfs.fleek.co/ipfs/${pageData.content}`
		} catch (err) {
			throw err
		}
	}
}

module.exports = Page
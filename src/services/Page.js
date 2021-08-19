class Page {
	constructor(database) {
		this.pageDb = database.root.collection('pages')
		this.accessDb = database.root.collection('access')
		this.cache = database.cache
	}

	async getContent({ comicId, chapterId, pageId, authAccountId }) {
		const key = `${comicId}::${chapterId}::${pageId}::${authAccountId}`
		try {
			const cacheExist = await this.cache.get(key)
			if (cacheExist) {
				return cacheExist
			}

			console.log(comicId, chapterId, pageId)
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
			return pageData.content
		} catch (err) {
			throw err
		}
	}
}

module.exports = Page

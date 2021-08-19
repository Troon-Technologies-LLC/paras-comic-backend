class PageSvc {
	constructor({ pageCtl }) {
		this.pageCtl = pageCtl
	}

	async getContent({ comicId, chapterId, pageId, authAccountId }) {
		try {
			return await this.pageCtl.getContent({
				comicId,
				chapterId,
				pageId,
				authAccountId,
			})
		} catch (err) {
			throw err
		}
	}
}

module.exports = PageSvc

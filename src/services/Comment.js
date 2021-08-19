const { ObjectId } = require('mongodb')

class CommentSvc {
	constructor({ commentCtl, likeCtl }) {
		this.commentCtl = commentCtl
		this.likeCtl = likeCtl
	}

	async create({ comicId, chapterId, accountId, body }) {
		try {
			return await this.commentCtl.create({
				comicId,
				chapterId,
				accountId,
				body,
			})
		} catch (err) {
			throw err
		}
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const results = await this.commentCtl.find(query, skip, limit)
			return {
				results: results,
				skip: skip,
				limit: limit,
			}
		} catch (err) {
			throw err
		}
	}

	async likes({ accountId, commentId }) {
		try {
			await this.likeCtl.likes({ accountId, commentId })

			return true
		} catch (err) {
			throw err
		}
	}

	async unlikes({ accountId, commentId }) {
		try {
			await this.likeCtl.unlikes({ accountId, commentId })

			return true
		} catch (err) {
			throw err
		}
	}

	async dislikes({ accountId, commentId }) {
		try {
			await this.likeCtl.dislikes({ accountId, commentId })

			return true
		} catch (err) {
			throw err
		}
	}

	async undislikes({ accountId, commentId }) {
		try {
			await this.likeCtl.undislikes({ accountId, commentId })

			return true
		} catch (err) {
			throw err
		}
	}

	async delete({ accountId, commentId }) {
		try {
			return await this.likeCtl.delete({ accountId, commentId })
		} catch (err) {
			throw err
		}
	}
}

module.exports = CommentSvc

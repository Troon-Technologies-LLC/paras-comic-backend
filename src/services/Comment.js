class CommentSvc {
	constructor({ commentCtl, likeCtl }, { dbSession }) {
		this.commentCtl = commentCtl
		this.likeCtl = likeCtl
		this.dbSession = dbSession
		this.inTx = false
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
			const currLike = await this.likeCtl.findOne({
				account_id: accountId,
				comment_id: commentId,
			})

			if (currLike && currLike.type === 'likes') {
				return true
			}

			await this.dbSession.startTransaction()
			this.inTx = true

			await this.likeCtl.likes(
				{ accountId, commentId },
				{ dbSession: this.dbSession }
			)

			let score = {
				likes: 1,
				score: 1,
			}

			if (currLike && currLike.type === 'dislikes') {
				score.dislikes = -1
			}

			await this.commentCtl.updateScore(
				{ commentId, score },
				{ dbSession: this.dbSession }
			)

			await this.dbSession.commitTransaction()

			return true
		} catch (err) {
			if (this.inTx) {
				await this.dbSession.abortTransaction()
			}
			throw err
		}
	}

	async unlikes({ accountId, commentId }) {
		try {
			await this.dbSession.startTransaction()
			this.inTx = true

			const deletedLike = await this.likeCtl.findOneAndDelete(
				{ accountId, commentId },
				{ dbSession: this.dbSession }
			)

			if (deletedLike) {
				let score = {
					likes: -1,
					score: -1,
				}

				await this.commentCtl.updateScore(
					{ commentId, score },
					{ dbSession: this.dbSession }
				)
			}

			await this.dbSession.commitTransaction()

			return true
		} catch (err) {
			if (this.inTx) {
				await this.dbSession.abortTransaction()
			}
			throw err
		}
	}

	async dislikes({ accountId, commentId }) {
		try {
			const currLike = await this.likeCtl.findOne({
				account_id: accountId,
				comment_id: commentId,
			})

			if (currLike && currLike.type === 'dislikes') {
				return true
			}

			await this.dbSession.startTransaction()
			this.inTx = true

			await this.likeCtl.dislikes(
				{ accountId, commentId },
				{ dbSession: this.dbSession }
			)

			let score = {
				dislikes: 1,
				score: -1,
			}

			if (currLike && currLike.type === 'likes') {
				score.likes = -1
			}

			await this.commentCtl.updateScore(
				{ commentId, score },
				{ dbSession: this.dbSession }
			)

			await this.dbSession.commitTransaction()

			return true
		} catch (err) {
			if (this.inTx) {
				await this.dbSession.abortTransaction()
			}
			throw err
		}
	}

	async undislikes({ accountId, commentId }) {
		try {
			await this.dbSession.startTransaction()
			this.inTx = true

			const deletedLike = await this.likeCtl.findOneAndDelete(
				{ accountId, commentId },
				{ dbSession: this.dbSession }
			)

			if (deletedLike) {
				let score = {
					dislikes: -1,
					score: 1,
				}

				await this.commentCtl.updateScore(
					{ commentId, score },
					{ dbSession: this.dbSession }
				)
			}

			await this.dbSession.commitTransaction()

			return true
		} catch (err) {
			if (this.inTx) {
				await this.dbSession.abortTransaction()
			}
			throw err
		}
	}

	async delete({ accountId, commentId }) {
		try {
			const deletedComment = await this.commentCtl.findOneAndDelete({
				accountId,
				commentId,
			})

			if (deletedComment) {
				return true
			} else {
				throw new Error('Comment not found')
			}
		} catch (err) {
			throw err
		}
	}
}

module.exports = CommentSvc

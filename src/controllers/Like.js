const { ObjectId } = require('mongodb')

class Comment {
	constructor({ database }) {
		this.commentDb = database.root.collection('comments')
		this.likesDb = database.root.collection('likes')
	}

	async likes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const likeExist = await this.likesDb.findOne({
				account_id: accountId,
				comment_id: formatCommentId,
			})

			// if like exist and type === 'like', return true
			if (likeExist && likeExist.type === 'likes') {
				return true
			}

			// add new like
			await this.likesDb.findOneAndUpdate(
				{
					account_id: accountId,
					comment_id: formatCommentId,
				},
				{
					$set: {
						type: 'likes',
						updated_at: new Date().getTime(),
					},
					$setOnInsert: { issued_at: new Date().getTime() },
				},
				{
					upsert: true,
				}
			)

			let inc = {
				likes: 1,
				score: 1,
			}
			if (likeExist && likeExist.type === 'dislikes') {
				inc.dislikes = -1
			}
			await this.commentDb.findOneAndUpdate(
				{
					_id: formatCommentId,
				},
				{
					$inc: inc,
				}
			)

			return true
		} catch (err) {
			throw err
		}
	}

	async unlikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const deletedLike = await this.likesDb.deleteOne({
				account_id: accountId,
				comment_id: formatCommentId,
			})

			// if like exist and type === 'like', return true
			if (deletedLike.deletedCount > 0) {
				let inc = {
					likes: -1,
					score: -1,
				}
				await this.commentDb.findOneAndUpdate(
					{
						_id: formatCommentId,
					},
					{
						$inc: inc,
					}
				)
			}

			return true
		} catch (err) {
			throw err
		}
	}

	async dislikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const likeExist = await this.likesDb.findOne({
				account_id: accountId,
				comment_id: formatCommentId,
			})

			// if like exist and type === 'dislike', return true
			if (likeExist && likeExist.type === 'dislikes') {
				return true
			}

			// add new like
			await this.likesDb.findOneAndUpdate(
				{
					account_id: accountId,
					comment_id: formatCommentId,
				},
				{
					$set: {
						type: 'dislikes',
						updated_at: new Date().getTime(),
					},
					$setOnInsert: { issued_at: new Date().getTime() },
				},
				{
					upsert: true,
				}
			)

			let inc = {
				dislikes: 1,
				score: -1,
			}
			if (likeExist && likeExist.type === 'likes') {
				inc.likes = -1
			}
			await this.commentDb.findOneAndUpdate(
				{
					_id: formatCommentId,
				},
				{
					$inc: inc,
				}
			)

			return true
		} catch (err) {
			throw err
		}
	}

	async undislikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const deletedLike = await this.likesDb.deleteOne({
				account_id: accountId,
				comment_id: formatCommentId,
			})

			// if like exist and type === 'like', return true
			if (deletedLike.deletedCount > 0) {
				let inc = {
					dislikes: -1,
					score: 1,
				}
				await this.commentDb.findOneAndUpdate(
					{
						_id: formatCommentId,
					},
					{
						$inc: inc,
					}
				)
			}

			return true
		} catch (err) {
			throw err
		}
	}

	async delete({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const deletedComment = await this.commentDb.deleteOne({
				_id: formatCommentId,
				account_id: accountId,
			})

			if (deletedComment.deletedCount > 0) {
				return true
			} else {
				throw new Error('Comment not found')
			}
		} catch (err) {
			throw err
		}
	}
}

module.exports = Comment

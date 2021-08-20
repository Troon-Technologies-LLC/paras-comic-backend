const { ObjectId } = require('mongodb')

class Like {
	constructor({ database }) {
		this.likesDb = database.root.collection('likes')
		this.commentDb = database.root.collection('comments')
	}

	async findOne(query) {
		const likeExist = await this.likesDb.findOne(query)

		return likeExist
	}

	async likes({ accountId, commentId }, { dbSession }) {
		try {
			// add new like
			await this.likesDb.findOneAndUpdate(
				{
					account_id: accountId,
					comment_id: commentId,
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
					session: dbSession,
				}
			)

			return true
		} catch (err) {
			throw err
		}
	}

	async dislikes({ accountId, commentId }, { dbSession }) {
		try {
			// update to dislike
			await this.likesDb.findOneAndUpdate(
				{
					account_id: accountId,
					comment_id: commentId,
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
					session: dbSession,
				}
			)

			return true
		} catch (err) {
			throw err
		}
	}

	async findOneAndDelete({ accountId, commentId }) {
		try {
			const deletedLike = await this.likesDb.findOneAndDelete(
				{
					account_id: accountId,
					comment_id: commentId,
				},
				{
					new: true,
				}
			)

			return deletedLike.value
		} catch (err) {
			throw err
		}
	}
}

module.exports = Like

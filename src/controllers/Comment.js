const { ObjectId } = require('mongodb')
const { v4: uuidv4 } = require('uuid')

class Comment {
	constructor({ database }) {
		this.commentDb = database.root.collection('comments')
		this.likesDb = database.root.collection('likes')
	}

	async create({ comicId, chapterId, accountId, body }) {
		try {
			const newData = {
				comment_id: uuidv4(),
				comic_id: comicId,
				chapter_id: chapterId,
				account_id: accountId,
				body: body,
				likes: 0,
				dislikes: 0,
				score: 0,
				issued_at: new Date().toISOString(),
			}
			await this.commentDb.insertOne(newData)

			return newData
		} catch (err) {
			throw err
		}
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const aggregationMatches = []

			if (query.comicId) {
				aggregationMatches.push({
					$match: {
						comic_id: query.comicId,
					},
				})
			}

			if (query.chapterId) {
				aggregationMatches.push({
					$match: {
						chapter_id: query.chapterId,
					},
				})
			}

			aggregationMatches.push({
				$addFields: {
					user_likes: null,
				},
			})

			if (query.authAccountId) {
				aggregationMatches.push({
					$addFields: {
						order: {
							$cond: [
								{
									$eq: ['$account_id', query.authAccountId],
								},
								0,
								1,
							],
						},
					},
				})

				aggregationMatches.push({
					$lookup: {
						from: 'likes',
						let: {
							comment_id: '$comment_id',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$comment_id', '$$comment_id'] },
											{ $eq: ['$account_id', query.authAccountId] },
										],
									},
								},
							},
						],
						as: 'my_likes',
					},
				})

				aggregationMatches.push({
					$addFields: {
						user_likes: {
							$cond: [
								{ $eq: [{ $size: '$my_likes' }, 0] },
								{ $literal: null },
								{ $arrayElemAt: ['$my_likes.type', 0] },
							],
						},
					},
				})
			}

			const aggregationFull = aggregationMatches.concat([
				{
					$sort: {
						order: 1,
						score: -1,
						issued_at: -1,
					},
				},
				{
					$project: {
						my_likes: 0,
						order: 0,
						score: 0,
					},
				},
				{
					$skip: skip,
				},
				{
					$limit: limit,
				},
			])

			const rawResults = await this.commentDb.aggregate(aggregationFull)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}

	async updateScore({ commentId, score }, { dbSession }) {
		try {
			await this.commentDb.findOneAndUpdate(
				{
					comment_id: commentId,
				},
				{
					$inc: score,
				},
				{
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
			const deletedComment = await this.commentDb.findOneAndDelete(
				{
					comment_id: commentId,
					account_id: accountId,
				},
				{
					new: true,
				}
			)

			return deletedComment.value
		} catch (err) {
			throw err
		}
	}
}

module.exports = Comment

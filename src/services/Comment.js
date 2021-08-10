const { ObjectId } = require('mongodb')

class Comment {
	constructor(database) {
		this.commentDb = database.root.collection('comments')
		this.likesDb = database.root.collection('likes')
	}

	async create({ comicId, chapterId, accountId, body }) {
		try {
			const newData = {
				comicId: comicId,
				chapterId: chapterId,
				accountId: accountId,
				body: body,
				likes: 0,
				dislikes: 0,
				score: 0,
				createdAt: new Date().getTime(),
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
						comicId: query.comicId,
					},
				})
			}

			if (query.chapterId) {
				aggregationMatches.push({
					$match: {
						chapterId: query.chapterId,
					},
				})
			}

			if (query.authAccountId) {
				aggregationMatches.push({
					$addFields: {
						order: {
							$cond: [
								{
									$eq: ['$accountId', query.authAccountId],
								},
								0,
								1,
							],
						},
					},
				})
			}

			const aggregationFull = aggregationMatches.concat([
				{
					$project: {
						order: 0,
						score: 0,
					},
				},
				{
					$sort: {
						order: 1,
						score: -1,
						createdAt: -1,
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

	async likes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const likeExist = await this.likesDb.findOne({
				accountId: accountId,
				commentId: formatCommentId,
			})

			// if like exist and type === 'like', return true
			if (likeExist && likeExist.type === 'likes') {
				return true
			}

			// add new like
			await this.likesDb.findOneAndUpdate(
				{
					accountId: accountId,
					commentId: formatCommentId,
				},
				{
					$set: {
						type: 'likes',
						updatedAt: new Date().getTime(),
					},
					$setOnInsert: { createdAt: new Date().getTime() },
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

	async dislikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const likeExist = await this.likesDb.findOne({
				accountId: accountId,
				commentId: formatCommentId,
			})

			// if like exist and type === 'dislike', return true
			if (likeExist && likeExist.type === 'dislikes') {
				return true
			}

			// add new like
			await this.likesDb.findOneAndUpdate(
				{
					accountId: accountId,
					commentId: formatCommentId,
				},
				{
					$set: {
						type: 'dislikes',
						updatedAt: new Date().getTime(),
					},
					$setOnInsert: { createdAt: new Date().getTime() },
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
}

module.exports = Comment

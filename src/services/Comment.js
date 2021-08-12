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

			aggregationMatches.push({
				$addFields: {
					userLikes: null,
				},
			})

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

				aggregationMatches.push({
					$lookup: {
						from: 'likes',
						let: {
							commentId: '$_id',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$commentId', '$$commentId'] },
											{ $eq: ['$accountId', query.authAccountId] },
										],
									},
								},
							},
						],
						as: 'myLikes',
					},
				})

				aggregationMatches.push({
					$addFields: {
						userLikes: {
							$cond: [
								{ $eq: [{ $size: '$myLikes' }, 0] },
								{ $literal: null },
								{ $arrayElemAt: ['$myLikes.type', 0] },
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
						createdAt: -1,
					},
				},
				{
					$project: {
						myLikes: 0,
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

			if (query.authAccountId) {
				await this.likesDb.findOne({})
			}

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

	async unlikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const deletedLike = await this.likesDb.deleteOne({
				accountId: accountId,
				commentId: formatCommentId,
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

	async undislikes({ accountId, commentId }) {
		const formatCommentId = ObjectId(commentId)

		try {
			const deletedLike = await this.likesDb.deleteOne({
				accountId: accountId,
				commentId: formatCommentId,
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
				accountId: accountId,
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

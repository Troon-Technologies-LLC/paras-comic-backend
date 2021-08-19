const { ObjectId } = require('mongodb')

class Comment {
	constructor({ database }) {
		this.commentDb = database.root.collection('comments')
		this.likesDb = database.root.collection('likes')
	}

	async create({ comicId, chapterId, accountId, body }) {
		try {
			const newData = {
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
							comment_id: '$_id',
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

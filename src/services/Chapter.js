class Chapter {
	constructor(database) {
		this.chapterDb = database.root.collection('chapters')
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
					status: null,
				},
			})

			if (query.authAccountId) {
				aggregationMatches.push({
					$lookup: {
						from: 'access',
						let: {
							account_id: '$account_id',
							comic_id: '$comic_id',
							chapter_id: '$chapter_id',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$account_id', query.authAccountId] },
											{ $eq: ['$comic_id', '$$comic_id'] },
											{ $eq: ['$chapter_id', '$$chapter_id'] },
										],
									},
								},
							},
						],
						as: 'my_access',
					},
				})
				aggregationMatches.push({
					$addFields: {
						status: {
							$cond: {
								if: {
									$gt: [{ $size: '$my_access' }, 0],
								},
								then: 'read',
								else: 'buy',
							},
						},
					},
				})
			}

			const aggregationFull = aggregationMatches.concat([
				{
					$project: {
						_id: 0,
						my_access: 0,
					},
				},
				{
					$sort: {
						chapter_id: -1,
					},
				},
				{
					$skip: skip,
				},
				{
					$limit: limit,
				},
			])

			const rawResults = await this.chapterDb.aggregate(aggregationFull)

			const results = await rawResults.toArray()
			return {
				results: results,
				skip: skip,
				limit: limit,
			}
		} catch (err) {
			throw err
		}
	}
}

module.exports = Chapter

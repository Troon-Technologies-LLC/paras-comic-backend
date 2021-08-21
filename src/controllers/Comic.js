class Comic {
	constructor({ database }) {
		this.comicDb = database.root.collection('comics')
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

			if (query.ownerId) {
				aggregationMatches.push({
					$lookup: {
						from: 'access',
						let: {
							account_id: '$account_id',
							comic_id: '$comic_id',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$account_id', query.ownerId] },
											{ $eq: ['$comic_id', '$$comic_id'] },
											{
												$gt: [
													{
														$size: '$access_tokens',
													},
													0,
												],
											},
										],
									},
								},
							},
						],
						as: 'my_access',
					},
				})
				aggregationMatches.push({
					$match: {
						my_access: {
							$gt: [{ $size: '$access_tokens' }, 0],
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
					$skip: skip,
				},
				{
					$limit: limit,
				},
			])

			const rawResults = await this.comicDb.aggregate(aggregationFull)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}
}

module.exports = Comic

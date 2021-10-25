class TokenSeriesCtl {
	constructor({ database }) {
		this.tokenSeriesDb = database.root.collection('token_series')
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			let aggregationMatches = []

			if (query.comicId) {
				aggregationMatches.push({
					$match: {
						comic_id: query.comicId,
					},
				})
			}

			if (query.tokenSeriesId) {
				aggregationMatches.push({
					$match: {
						token_series_id: query.tokenSeriesId,
					},
				})
			}

			if (query.category === 'chapter') {
				aggregationMatches.push({
					$match: {
						'metadata.chapter_id': { $exists: true },
					},
				})
			}
			if (query.category === 'collectible') {
				aggregationMatches.push({
					$match: {
						'metadata.chapter_id': { $exists: false },
					},
				})
			}

			aggregationMatches = aggregationMatches.concat([
				{
					$project: {
						_id: 0,
					},
				},
				{
					$sort: {
						'metadata.issued_at': -1,
					},
				},
				{
					$skip: skip,
				},
				{
					$limit: limit,
				},
			])

			aggregationMatches.push({
				$set: {
					price:  {$toString: '$price'}
				}
			})

			const rawResults = await this.tokenSeriesDb.aggregate(aggregationMatches)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}
}

module.exports = TokenSeriesCtl

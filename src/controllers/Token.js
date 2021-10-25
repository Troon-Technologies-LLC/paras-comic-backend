class TokenCtl {
	constructor({ database }) {
		this.tokenDb = database.root.collection('tokens')
	}

	async find(query = {}, skip = 0, limit = 30) {
		try {
			let aggregationMatches = []

			if (query.comicId) {
				aggregationMatches.push({
					$match: {
						'metadata.comic_id': query.comicId,
					},
				})
			}

			if (query.ownerId) {
				aggregationMatches.push({
					$match: {
						owner_id: query.ownerId,
					},
				})
			}

			if (query.tokenId) {
				aggregationMatches.push({
					$match: {
						token_id: query.tokenId,
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

			aggregationMatches.push({
				$set: {
					edition_id: {$toInt: '$edition_id'}
				}
			})

			aggregationMatches = aggregationMatches.concat([
				{
					$project: {
						_id: 0,
					},
				},
				{
					$sort: {
						chapter_id: 1,
						edition_id: 1,
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

			const rawResults = await this.tokenDb.aggregate(aggregationMatches)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}
}

module.exports = TokenCtl

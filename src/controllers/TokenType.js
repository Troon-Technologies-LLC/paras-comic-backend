class TokenTypeCtl {
	constructor({ database }) {
		this.tokenTypeDb = database.root.collection('token_types')
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

			if (query.tokenType) {
				aggregationMatches.push({
					$match: {
						token_type: query.tokenType,
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

			const aggregationFull = aggregationMatches.concat([
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

			const rawResults = await this.tokenTypeDb.aggregate(aggregationFull)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}
}

module.exports = TokenTypeCtl

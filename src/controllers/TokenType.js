class TokenTypeCtl {
	constructor({ database }) {
		this.tokenTypeDb = database.root.collection('token_types')
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const aggregationMatches = []

			if (query.tokenType) {
				aggregationMatches.push({
					$match: {
						token_type: query.tokenType,
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

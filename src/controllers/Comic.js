class Comic {
	constructor({ database }) {
		this.comicDb = database.root.collection('comics')
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const aggregationMatches = []

			if (query.comic_id) {
				aggregationMatches.push({
					$match: {
						comic_id: query.comic_id,
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

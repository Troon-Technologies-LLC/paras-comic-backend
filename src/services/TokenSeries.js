class TokenSeriesSvc {
	constructor({ tokenSeriesCtl }) {
		this.tokenSeriesCtl = tokenSeriesCtl
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const results = await this.tokenSeriesCtl.find(query, skip, limit)
			return {
				results: results,
				skip: skip,
				limit: 0,
			}
		} catch (err) {
			throw err
		}
	}
}

module.exports = TokenSeriesSvc

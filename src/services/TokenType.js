class TokenTypeSvc {
	constructor({ tokenTypeCtl }) {
		this.tokenTypeCtl = tokenTypeCtl
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const results = await this.tokenTypeCtl.find(query, skip, limit)
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

module.exports = TokenTypeSvc

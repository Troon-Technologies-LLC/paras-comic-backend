class TokenSvc {
	constructor({ tokenCtl }) {
		this.tokenCtl = tokenCtl
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const results = await this.tokenCtl.find(query, skip, limit)
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

module.exports = TokenSvc

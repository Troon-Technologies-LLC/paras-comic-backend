module.exports = (near, networkId) => {
	return async (req, res, next) => {
		try {
			const accId = await near.authSignature(req.headers.authorization, networkId)
			if (accId) {
				req.accountId = accId
				next()
			} else {
				throw new Error('unauthorized')
			}
		} catch (err) {
			return res.status(401).json({
				success: 0,
				message: err.message,
			})
		}
	}
}

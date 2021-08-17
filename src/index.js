const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
// const slowDown = require('express-slow-down')
const Database = require('./helpers/Database')
const axios = require('axios')
// const ParasSDK = require('paras-sdk')
const { providers, keyStores } = require('near-api-js')
const authenticate = require('./middleware/authenticate')
const Near = require('./helpers/Near')
const Comment = require('./services/Comment')

const PORT = process.env.PORT || 9090
const server = express()

// const speedLimiter = slowDown({
// 	windowMs: 1 * 60 * 1000,
// 	delayAfter: 5000,
// 	delayMs: 100,
// })

const main = async () => {
	// if (process.env.NODE_ENV === 'mainnet') {
	// 	server.set('trust proxy', 1)
	// 	server.use(speedLimiter)
	// }
	server.use(cors())
	server.use(bodyParser.urlencoded({ extended: true }))
	server.use(bodyParser.json())

	const database = new Database()
	await database.init()

	const near = new Near()
	await near.init()

	const comment = new Comment(database)

	const getChapterDetails = async (chapterData, viewerId) => {
		const data = chapterData
		let result = data
		result.isRead = false
		if (viewerId) {
			for await (const requirement of data.requirements) {
				const [networkId, contractId, tokenId, quantity] =
					requirement.split('::')
				const args = JSON.stringify({
					ownerId: viewerId,
					tokenId: tokenId,
				})
				const rawResult = await near.providers[networkId].query({
					request_type: 'call_function',
					account_id: contractId,
					method_name: 'balanceOf',
					args_base64: Buffer.from(args).toString('base64'),
					finality: 'optimistic',
				})
				const owned = JSON.parse(Buffer.from(rawResult.result).toString())

				if (owned >= quantity) {
					result.status = 'read'
					return result
				}
			}
		}

		result.status = 'sold_out'
		const [networkId, contractId, tokenId, _] =
			result.requirements[result.requirements.length - 1].split('::')
		const args = JSON.stringify({
			ownerId: result.authorId,
			tokenId: tokenId,
		})
		const rawResult = await near.providers[networkId].query({
			request_type: 'call_function',
			account_id: contractId,
			method_name: 'getMarketData',
			args_base64: Buffer.from(args).toString('base64'),
			finality: 'optimistic',
		})
		const officialMarket = JSON.parse(Buffer.from(rawResult.result).toString())
		if (officialMarket) {
			result.status = `price_${officialMarket.price}`
		}

		return result
	}

	server.get('/', async (req, res) => {
		res.json({
			status: 1,
		})
	})

	server.get('/chapters', async (req, res) => {
		const { comicId, authorId } = req.query
		const accountId = await near.authSignature(
			req.headers.authorization,
			'testnet'
		)
		try {
			const rawData = await database.root.collection('chapters').find({
				comicId: comicId,
				authorId: authorId,
			})
			const data = await rawData.toArray()
			const results = []
			for (const chapterData of data) {
				const chapterDetails = await getChapterDetails(chapterData, accountId)
				results.push(chapterDetails)
			}

			return res.json({
				status: 1,
				data: results,
			})
		} catch (err) {
			return res.status(400).json({
				status: 0,
				message: err.message,
			})
		}
	})

	server.get('/unlockables/:id', authenticate(near), async (req, res) => {
		// const [titleId, authorId, chapterId, pageId] = req.params.id.split('::')
		const accountId = req.accountId
		try {
			const rawData = await database.root.collection('unlockables').find({
				id: req.params.id,
			})
			const data = await rawData.toArray()
			if (data.length === 0) {
				throw new Error('not found')
			}
			// const requirements = data.map(d => {
			//   return d.requirements
			// })
			// requirements

			// for await (const requirement of requirements) {
			//   const [networkId, contractId, tokenId, quantity] = requirement.split('::')
			//   const args = JSON.stringify({
			//     ownerId: accountId,
			//     tokenId: tokenId
			//   })
			//   const rawResult = await near.providers[networkId].query({
			//     request_type: "call_function",
			//     account_id: contractId,
			//     method_name: "balanceOf",
			//     args_base64: Buffer.from(args).toString('base64'),
			//     finality: "optimistic",
			//   })
			//   const owned = JSON.parse(Buffer.from(rawResult.result).toString());

			//   if (owned >= quantity) {
			//     return axios({
			//       method: 'get',
			//       url: unlockable.content,
			//       responseType: 'stream'
			//     })
			//       .then(function(response) {
			//         response.data.pipe(res)
			//     })
			//   }
			// }
			for await (const unlockable of data) {
				let result = []
				for await (const requirement of unlockable.requirements) {
					const [networkId, contractId, tokenId, quantity] =
						requirement.split('::')
					const args = JSON.stringify({
						ownerId: accountId,
						tokenId: tokenId,
					})
					const rawResult = await near.providers[networkId].query({
						request_type: 'call_function',
						account_id: contractId,
						method_name: 'balanceOf',
						args_base64: Buffer.from(args).toString('base64'),
						finality: 'optimistic',
					})
					const owned = JSON.parse(Buffer.from(rawResult.result).toString())

					if (owned >= quantity) {
						result.push(true)
					} else {
						result.push(false)
					}
				}
				if (result.every((v) => v === true)) {
					return axios({
						method: 'get',
						url: unlockable.content,
						responseType: 'stream',
					}).then(function (response) {
						response.data.pipe(res)
					})
				}
			}
			return res.status(400).json({
				status: 0,
				message: 'unauthorized',
			})
		} catch (err) {
			return res.status(400).json({
				status: 0,
				message: err.message,
			})
		}
	})

	server.post('/comments', authenticate(near, 'testnet'), async (req, res) => {
		try {
			const params = {
				accountId: req.accountId,
				comicId: req.body.comic_id,
				chapterId: req.body.chapter_id,
				body: req.body.body,
			}
			const result = await comment.create(params)
			return res.json({
				status: 1,
				data: result,
			})
		} catch (err) {
			return res.status(400).json({
				status: 0,
				message: err.message,
			})
		}
	})

	server.get('/comments', async (req, res) => {
		const accountId = await near.authSignature(
			req.headers.authorization,
			'testnet'
		)
		try {
			const query = {
				comicId: req.query.comic_id,
				chapterId: req.query.chapter_id,
				authAccountId: accountId,
			}

			const skip = req.query.__skip ? parseInt(req.query.__skip) : 0
			const limit = req.query.__limit
				? Math.min(parseInt(req.query.__limit), 10)
				: 10

			const results = await comment.find(query, skip, limit)

			return res.json({
				status: 1,
				data: results,
			})
		} catch (err) {
			return res.status(400).json({
				status: 0,
				message: err.message,
			})
		}
	})

	server.put(
		'/comments/likes',
		authenticate(near, 'testnet'),
		async (req, res) => {
			try {
				const accountId = req.accountId
				const params = {
					accountId: accountId,
					commentId: req.body.comment_id,
				}
				const result = await comment.likes(params)
				return res.json({
					status: 1,
					data: result,
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.put(
		'/comments/unlikes',
		authenticate(near, 'testnet'),
		async (req, res) => {
			try {
				const accountId = req.accountId
				const params = {
					accountId: accountId,
					commentId: req.body.comment_id,
				}
				const result = await comment.unlikes(params)
				return res.json({
					status: 1,
					data: result,
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.put(
		'/comments/dislikes',
		authenticate(near, 'testnet'),
		async (req, res) => {
			try {
				const accountId = req.accountId
				const params = {
					accountId: accountId,
					commentId: req.body.comment_id,
				}
				const result = await comment.dislikes(params)
				return res.json({
					status: 1,
					data: result,
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.put(
		'/comments/undislikes',
		authenticate(near, 'testnet'),
		async (req, res) => {
			try {
				const accountId = req.accountId
				const params = {
					accountId: accountId,
					commentId: req.body.comment_id,
				}
				const result = await comment.undislikes(params)
				return res.json({
					status: 1,
					data: result,
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.delete(
		'/comments/:commentId',
		authenticate(near, 'testnet'),
		async (req, res) => {
			try {
				const accountId = req.accountId
				const params = {
					accountId: accountId,
					commentId: req.body.comment_id,
				}
				const result = await comment.delete(params)
				return res.json({
					status: 1,
					data: result,
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.listen(PORT, () => {
		console.log(`Comic Paras: Backend running on PORT ${PORT}`)
	})
}

module.exports = main

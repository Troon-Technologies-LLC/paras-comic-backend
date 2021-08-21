const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const axios = require('axios')
// const slowDown = require('express-slow-down')

const Database = require('./repositories/Database')
const Storage = require('./repositories/Storage')
const Near = require('./repositories/Near')

const CommentCtl = require('./controllers/Comment')
const ComicCtl = require('./controllers/Comic')
const ChapterCtl = require('./controllers/Chapter')
const PageCtl = require('./controllers/Page')
const LikeCtl = require('./controllers/Like')

const authenticate = require('./middleware/authenticate')
const multer = require('./middleware/multer')
const ComicSvc = require('./services/Comic')
const CommentSvc = require('./services/Comment')
const ChapterSvc = require('./services/Chapter')
const PageSvc = require('./services/Page')

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

	const dbSession = database.client.startSession()

	const storage = new Storage(database)
	await storage.init()

	const near = new Near()
	await near.init()

	const comicCtl = new ComicCtl({ database })
	const commentCtl = new CommentCtl({ database })
	const likeCtl = new LikeCtl({ database })
	const chapterCtl = new ChapterCtl({ database, storage, near })
	const pageCtl = new PageCtl({ database, storage })

	const comicSvc = new ComicSvc({ comicCtl })
	const commentSvc = new CommentSvc({ commentCtl, likeCtl }, { dbSession })
	const chapterSvc = new ChapterSvc(
		{ chapterCtl, comicCtl, pageCtl },
		{ dbSession }
	)
	const pageSvc = new PageSvc({ pageCtl })

	server.get('/', async (req, res) => {
		res.json({
			status: 1,
		})
	})

	server.get('/comics', async (req, res) => {
		try {
			const query = {
				comic_id: req.query.comic_id,
			}

			const skip = req.query.__skip ? parseInt(req.query.__skip) : 0
			const limit = req.query.__limit
				? Math.min(parseInt(req.query.__limit), 10)
				: 10

			const results = await comicSvc.find(query, skip, limit)

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

	server.get('/chapters', async (req, res) => {
		const { comic_id, chapter_id } = req.query
		const accountId = await near.authSignature(
			req.headers.authorization,
			'testnet'
		)
		try {
			const results = await chapterSvc.find({
				comicId: comic_id,
				chapterId: chapter_id,
				authAccountId: 'comicSvc.test.near',
			})

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

	server.get(
		'/pages/:comic_id/:chapter_id/:page_id',
		authenticate(near),
		async (req, res) => {
			const accountId = req.accountId
			try {
				const content = await pageSvc.getContent({
					comicId: req.params.comic_id,
					chapterId: req.params.chapter_id,
					pageId: req.params.page_id,
					authAccountId: 'riqi.test.near',
				})
				return axios({
					method: 'get',
					url: content,
					responseType: 'stream',
				}).then(function (response) {
					response.data.pipe(res)
				})
			} catch (err) {
				return res.status(400).json({
					status: 0,
					message: err.message,
				})
			}
		}
	)

	server.post('/chapters', authenticate(near, 'testnet'), async (req, res) => {
		try {
			await multer.bulk(req, res)

			const result = await chapterSvc.create(req.body, req.files)

			res.json({
				status: 1,
				data: result,
			})
		} catch (err) {
			console.log(err)
			res.status(400).json({
				status: 0,
				message: err.message || err,
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
			const result = await commentSvc.create(params)
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

			const results = await commentSvc.find(query, skip, limit)

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
				const result = await commentSvc.likes(params)
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
				const result = await commentSvc.unlikes(params)
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
				const result = await commentSvc.dislikes(params)
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
				const result = await commentSvc.undislikes(params)
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
					commentId: req.params.commentId,
				}
				const result = await commentSvc.delete(params)
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

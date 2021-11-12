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
const TokenCtl = require('./controllers/Token')
const TokenSvc = require('./services/Token')
const TokenSeriesCtl = require('./controllers/TokenSeries')
const TokenSeriesSvc = require('./services/TokenSeries')

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
  const tokenCtl = new TokenCtl({ database })
  const tokenSeriesCtl = new TokenSeriesCtl({ database, storage, near })

  const comicSvc = new ComicSvc({ comicCtl })
  const tokenSvc = new TokenSvc({ tokenCtl })
  const tokenSeriesSvc = new TokenSeriesSvc({ tokenSeriesCtl })
  const commentSvc = new CommentSvc({ commentCtl, likeCtl }, { dbSession })
  const chapterSvc = new ChapterSvc(
    { chapterCtl, comicCtl, pageCtl },
    { dbSession }
  )
  const pageSvc = new PageSvc({ comicCtl, chapterCtl, pageCtl }, { dbSession })

  server.get('/', async (req, res) => {
    res.json({
      status: 1,
    })
  })

  server.get('/storage-cache/:hash', async (req, res) => {
    try {
      const result = await storage.get(req.params.hash)
      const resultJson = JSON.parse(result[0].content.toString('utf8'))
      res.json(resultJson)
    } catch (err) {
      console.log(err)
      res.status(400).json({
        status: 0,
        message: err.message || err,
      })
    }
  })

  server.get('/comics', async (req, res) => {
    try {
      const query = {
        comicId: req.query.comic_id,
        ownerId: req.query.owner_id,
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

  server.get('/token-series', async (req, res) => {
    try {
      const query = {
        comicId: req.query.comic_id,
        tokenSeriesId: req.query.token_series_id,
        category: req.query.category,
      }

      const skip = req.query.__skip ? parseInt(req.query.__skip) : 0
      const limit = req.query.__limit
        ? Math.min(parseInt(req.query.__limit), 10)
        : 10

      const results = await tokenSeriesSvc.find(query, skip, limit)

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

  server.post('/token-series', authenticate(near, 'testnet'), async (req, res) => {
    try {
      const accountId = req.accountId
      if (process.env.OWNER_ACCOUNT_ID !== accountId) {
        throw new Error('Only administrator')
      }

      const result = await tokenSeriesSvc.create(req.body)

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

  server.get('/tokens', async (req, res) => {
    try {
      const query = {
        comicId: req.query.comic_id,
        ownerId: req.query.owner_id,
        tokenSeriesId: req.query.token_series_id,
        tokenId: req.query.token_id,
        category: req.query.category,
      }

      const skip = req.query.__skip ? parseInt(req.query.__skip) : 0
      const limit = req.query.__limit ? parseInt(req.query.__limit) : 30

      const results = await tokenSvc.find(query, skip, limit)

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
    const { comic_id, chapter_id, chapter_ids, token_series_id } = req.query
    const accountId = await near.authSignature(
      req.headers.authorization,
      'testnet'
    )
    try {
      const results = await chapterSvc.find({
        comicId: comic_id,
        chapterId: chapter_id,
        tokenSeriesId: token_series_id,
        chapterIds: chapter_ids,
        authAccountId: accountId,
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

  server.post(
    '/pages/:comid_id/:chapter_id',
    authenticate(near, 'testnet'),
    async (req, res) => {
      try {
        const accountId = req.accountId
        if (process.env.OWNER_ACCOUNT_ID !== accountId) {
          throw new Error('Only administrator')
        }

        const result = await pageSvc.createBulk({
          ...req.body,
          comic_id: req.params.comid_id,
          chapter_id: req.params.chapter_id,
        })

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
    }
  )

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
          lang: null,
          authAccountId: accountId,
        })
        res.set('Cache-Control', 'private, max-age=300')

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

  server.get(
    '/pages/:comic_id/:chapter_id/:page_id/:lang',
    authenticate(near),
    async (req, res) => {
      const accountId = req.accountId
      try {
        const content = await pageSvc.getContent({
          comicId: req.params.comic_id,
          chapterId: req.params.chapter_id,
          pageId: req.params.page_id,
          lang: req.params.lang,
          authAccountId: accountId,
        })
        res.set('Cache-Control', 'private, max-age=300')

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

  server.post(
    '/upload/single',
    authenticate(near, 'testnet'),
    async (req, res) => {
      try {
        await multer.bulk(req, res)
        console.log(req.files[0])

        const result = await storage.upload(req.files[0], 'file')

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
    }
  )

  server.post('/chapters', authenticate(near, 'testnet'), async (req, res) => {
    try {
      const accountId = req.accountId
      if (process.env.OWNER_ACCOUNT_ID !== accountId) {
        throw new Error('Only administrator')
      }

      const result = await chapterSvc.create(req.body)

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

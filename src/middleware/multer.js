const util = require('util')
const multer = require('multer')
const { getTempPath, maxImgSize, maxImgSizeBulk } = require('../configs')

const tempDir = getTempPath()

const uploadFile = multer({
	storage: multer.diskStorage({
		destination(req, file, cb) {
			cb(null, tempDir)
		},
		filename(req, file, cb) {
			cb(null, `${Date.now()}_${file.originalname}`)
		},
	}),
	limits: { fileSize: maxImgSize },
}).single('file')

const uploadFiles = multer({
	storage: multer.diskStorage({
		destination(req, file, cb) {
			cb(null, tempDir)
		},
		filename(req, file, cb) {
			cb(null, `${Date.now()}_${file.originalname}`)
		},
	}),
	limits: { fileSize: maxImgSizeBulk },
}).array('files')

const single = util.promisify(uploadFile)
const bulk = util.promisify(uploadFiles)

module.exports = {
	single: single,
	bulk: bulk,
}

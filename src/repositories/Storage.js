const fleekStorage = require('@fleekhq/fleek-storage-js')
const CID = require('cids')
const { v4: uuidv4 } = require('uuid')
const { existsSync, mkdirSync, readFileSync, unlinkSync } = require('fs')
const { getTempPath } = require('../configs')
const { default: axios } = require('axios')
const ImageKit = require('imagekit')

class Storage {
	constructor(database) {
		this.ipfs = null
		this.imagekit = null
		this.database = database
	}

	async init() {
		const tempDir = getTempPath()
		if (!existsSync(tempDir)) {
			mkdirSync(tempDir)
		}

		if (process.env.IMAGEKIT_API_KEY && process.env.IMAGEKIT_API_SECRET) {
			this.imagekit = new ImageKit({
				publicKey: process.env.IMAGEKIT_API_KEY,
				privateKey: process.env.IMAGEKIT_API_SECRET,
				urlEndpoint: 'https://ik.imagekit.io/o5tkmggpmuq',
			})
		}
	}

	async upload(input, type = 'file') {
		let result = null
		let content = null
		if (type === 'file') {
			content = readFileSync(input.path)
			const uploadedFile = await fleekStorage.upload({
				apiKey: process.env.FLEEK_API_KEY,
				apiSecret: process.env.FLEEK_API_SECRET,
				key: input.filename,
				data: content,
			})
			result = uploadedFile.hash
		} else {
			const uploadedFile = await fleekStorage.upload({
				apiKey: process.env.FLEEK_API_KEY,
				apiSecret: process.env.FLEEK_API_SECRET,
				key: uuidv4(),
				data: input,
			})
			result = uploadedFile.hash
		}
		if (!result) {
			throw 'Failed to upload'
		}
		if (result.cid) {
			result = result.cid.toString()
		}
		result = result.replace(/^"|"$/g, '')
		// if type = file, upload to cdn
		if (
			type === 'file' &&
			this.imagekit &&
			process.env.NODE_ENV === 'mainnet'
		) {
			try {
				await this.imagekit.upload({
					file: content,
					fileName: result,
					tags: [process.env.NODE_ENV],
					useUniqueFileName: false,
				})
			} catch (err) {
				console.log(err)
			}
		}
		const key = `storage::${result}`
		const value = [{ cid: result, content: content }]
		this.database.cache.set(key, value)
		return `${result}`
	}

	async isCID(hash) {
		try {
			new CID(hash)
			return true
		} catch (e) {
			return false
		}
	}

	_getUrl(path) {
		const cid = new CID(path)
		const url =
			cid.version === 0
				? `https://ipfs-gateway.paras.id/ipfs/${path}`
				: `https://ipfs.fleek.co/ipfs/${path}`

		return url
	}

	async _get(path) {
		const url = this._getUrl(path)
		const resp = await axios.get(url, {
			responseType: 'arraybuffer',
		})
		const result = [{ cid: path, content: resp.data }]

		return result
	}

	async get(path) {
		try {
			const key = `storage::${path}`

			const result = await this.database.cache.wrap(key, () => {
				return this._get(path)
			})
			return result
		} catch (err) {
			console.log(err)
			throw err
		}
	}
}

module.exports = Storage

const { default: axios } = require('axios')
const { encode } = require('blurhash')
const sharp = require('sharp')

const encodeImageToBlurhash = (url) => {
	return new Promise(async (resolve, reject) => {
		const resp = await axios.get(url, {
			responseType: 'arraybuffer',
		})
		sharp(resp.data)
			.raw()
			.ensureAlpha()
			.resize(32, 32, { fit: 'inside' })
			.toBuffer((err, buffer, info) => {
				if (err) return reject(err)
				resolve(
					encode(new Uint8ClampedArray(buffer), info.width, info.height, 4, 4)
				)
			})
	})
}

module.exports = {
	encodeImageToBlurhash,
}

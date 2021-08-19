const path = require('path')

module.exports = {
	getTempPath() {
		return path.join(process.cwd(), 'temp')
	},
	maxImgSize: 1024 * 1024 * 20,
	maxImgSizeBulk: 1024 * 1024 * 5,
	twitterUrl: `https://twitter.com`,
	instagramUrl: `https://instagram.com`,
}

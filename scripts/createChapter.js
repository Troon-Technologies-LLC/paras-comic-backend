const { default: axios } = require('axios')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')

/**
 * Promise all
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 */
function promiseAllP(items, block) {
	var promises = []
	items.forEach(function (item, index) {
		promises.push(
			(function (item, i) {
				return new Promise(function (resolve, reject) {
					return block.apply(this, [item, index, resolve, reject])
				})
			})(item, index)
		)
	})
	return Promise.all(promises)
} //promiseAll

/**
 * read files
 * @param dirname string
 * @return Promise
 * @author Loreto Parisi (loretoparisi at gmail dot com)
 * @see http://stackoverflow.com/questions/10049557/reading-all-files-in-a-directory-store-them-in-objects-and-send-the-object
 */
function readFiles(dirname) {
	return new Promise((resolve, reject) => {
		fs.readdir(dirname, function (err, filenames) {
			if (err) return reject(err)
			promiseAllP(filenames, (filename, index, resolve, reject) => {
				fs.readFile(path.resolve(dirname, filename), function (err, content) {
					if (err) return reject(err)
					return resolve({ filename: filename, contents: content })
				})
			})
				.then((results) => {
					return resolve(results)
				})
				.catch((error) => {
					return reject(error)
				})
		})
	})
}

const main = async () => {
	const pages = await readFiles(path.join(process.cwd(), 'temp', 'chapters'))

	// const url = `https://comic-dev-api.paras.id`
	const url = `https://api-comic-alpha-testnet.paras.id`
	// const url = `http://localhost:9090`

	const images = [...Array(pages.length).keys()]
	const imageHashes = []

	for await (const page of pages) {
		const [idx, ext] = page.filename.split('.')
		images[parseInt(idx)] = page
	}

	for await (const [key, value] of images.entries()) {
		const formData = new FormData()
		formData.append('files', value.contents, value.filename)

		const resp = await axios.post(`${url}/upload/single`, formData, {
			headers: {
				'Content-Type':
					'multipart/form-data;boundary=' + formData.getBoundary(),
				Authorization: process.env.AUTH_TOKEN,
			},
		})
		fs.writeFileSync('./chapter1_hashes.json', JSON.stringify(imageHashes))
		imageHashes.push(resp.data.data)
		console.log(`Uploaded ${parseFloat(key / pages.length).toPrecision(4)}%`)
	}

	try {
		console.log('Creating new chapter...')
		const resp = await axios.post(
			`${url}/chapters`,
			{
				comic_id: 'paradigm',
				chapter_id: 1,
				price: '0',
				description:
					'In desolate and sequestered lands, Abee wakes up remembering nothing but the hackathon he just participated in. Alongside three new companies, Abee will take part in an adventure, discover new knowledge, and commit risky endeavors.',
				author_ids: ['afiq.testnet'],
				collection: 'Paradigm',
				subtitle: 'Genesis',
				images: imageHashes,
			},
			{
				headers: {
					Authorization: process.env.AUTH_TOKEN,
				},
			}
		)
		console.log(resp)
	} catch (err) {
		console.log(err)
	}
}

main()

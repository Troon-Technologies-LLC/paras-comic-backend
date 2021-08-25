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
				fs.readFile(
					path.resolve(dirname, filename),
					'binary',
					function (err, content) {
						if (err) return reject(err)
						return resolve({ filename: filename, contents: content })
					}
				)
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

	const formData = new FormData()

	formData.append(`comic_id`, `paradigm`)
	formData.append(`chapter_id`, `5`)
	formData.append(`subtitle`, `Genesis`)
	formData.append(`price`, `0`)
	formData.append(`collection`, `Paradigm`)
	formData.append(
		`description`,
		`In desolate and sequestered lands, Abee wakes up remembering nothing but the hackathon he just participated in. Alongside three new companies, Abee will take part in an adventure, discover new knowledge, and commit risky endeavors.`
	)
	formData.append(`author_ids`, JSON.stringify([`afiq.testnest`]))

	const files = [...Array(pages.length).keys()]

	for await (const page of pages) {
		const [idx, ext] = page.filename.split('.')
		files[parseInt(idx)] = page
	}

	for await (const [key, value] of files.entries()) {
		formData.append(`files`, value.contents, value.filename)
	}

	const url = `https://comic-dev-api.paras.id`
	try {
		console.log('Uploading...')
		const resp = await axios.post(`${url}/chapters`, formData, {
			maxContentLength: Infinity,
			maxBodyLength: Infinity,
			headers: {
				'Content-Type':
					'multipart/form-data;boundary=' + formData.getBoundary(),
				Authorization:
					'dGhlY3JlYXRvci50ZXN0bmV0JjJjMGI4ZDJlM2JjYTRkOThkNmFhZWYxOWE4M2I2ZTE3ZmMwZDhiNWU4MmJkZTlmNjU0ZWU3Zjk5NzEzYjQ5YmQmOWI3YTgyODRlMGZiNzJmYWY2YWExZjlhN2MyZGEzMDE0YzI4YzllNmZjMDk1M2I5YjVkY2RlMzQ4NWJiMDIwNTYxYzI1ZGFhMWM3N2EwNDhlY2Y2ZTYxOWJmNDljYzQ1M2YxOGMxNzZjOGFlMDU5N2YxZDRlNTc3MjcyMDQ1MDc=',
			},
		})
		console.log(resp)
	} catch (err) {
		console.log(err)
	}
}

main()

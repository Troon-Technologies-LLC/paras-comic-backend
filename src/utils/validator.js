const yup = require('yup')

// comic_id
// chapter_id
// price
// title
// description
// author_ids
// collection
// subtitle
module.exports = {
	chapterCreate: yup.object().shape({
		comic_id: yup.string().required(),
		chapter_id: yup.string().required(),
		price: yup.string().required(),
		description: yup.string().required(),
		author_ids: yup.array().required().of(yup.string()).min(1),
		collection: yup.string().required(),
		subtitle: yup.string().required(),
		images: yup.array().required().of(yup.string()).min(2),
	}),
}

class Chapter {
	constructor({ database, storage, near }) {
		this.chapterDb = database.root.collection('chapters')
		this.storage = storage
		this.near = near
	}

	async find(query = {}, skip = 0, limit = 10) {
		try {
			const aggregationMatches = []

			if (query.comicId) {
				aggregationMatches.push({
					$match: {
						comic_id: query.comicId,
					},
				})
			}

			if (query.chapterId) {
				aggregationMatches.push({
					$match: {
						chapter_id: parseInt(query.chapterId),
					},
				})
			}
			if (query.chapterIds) {
				aggregationMatches.push({
					$match: {
						chapter_id: {
							$in: query.chapterIds.map((id) => parseInt(id)),
						},
					},
				})
			}

			aggregationMatches.push({
				$addFields: {
					status: 'buy',
				},
			})

			if (query.authAccountId) {
				aggregationMatches.push({
					$lookup: {
						from: 'access',
						let: {
							account_id: '$account_id',
							comic_id: '$comic_id',
							chapter_id: '$chapter_id',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$account_id', query.authAccountId] },
											{ $eq: ['$comic_id', '$$comic_id'] },
											{ $eq: ['$chapter_id', '$$chapter_id'] },
										],
									},
								},
							},
						],
						as: 'my_access',
					},
				})
				aggregationMatches.push({
					$addFields: {
						my_access: {
							$arrayElemAt: ['$my_access', 0],
						},
					},
				})
				aggregationMatches.push({
					$addFields: {
						status: {
							$cond: {
								if: {
									$gt: [{ $size: '$my_access.access_tokens' }, 0],
								},
								then: 'read',
								else: 'buy',
							},
						},
					},
				})
			}

			const aggregationFull = aggregationMatches.concat([
				{
					$project: {
						_id: 0,
						my_access: 0,
					},
				},
				{
					$sort: {
						chapter_id: 1,
						edition_id: 1,
					},
				},
				{
					$skip: skip,
				},
				{
					$limit: limit,
				},
			])

			const rawResults = await this.chapterDb.aggregate(aggregationFull)

			const results = await rawResults.toArray()
			return results
		} catch (err) {
			throw err
		}
	}

	async create({
		tokenType,
		title,
		price,
		coverFile,
		description,
		blurhash,
		authorIds,
		pageCount,
		collection,
		subtitle,
	}) {
		try {
			// reference
			const reference = await this.storage.upload(
				JSON.stringify({
					description: description,
					blurhash: blurhash,
					author_ids: authorIds,
					page_count: pageCount,
					collection: collection,
					subtitle: subtitle,
					issued_at: new Date().toISOString(),
				}),
				'json',
				true
			)

			// create new token type & chapter
			const media = await this.storage.upload(coverFile, 'file', true)

			const params = {
				token_type: tokenType,
				token_metadata: {
					title: title,
					media: media,
					reference: reference,
				},
				author_id: authorIds[0],
				price: price,
			}
			console.log(params)

			// dev-1629375638187-90104949233722
			await this.near.functionCall(
				'rng.testnet',
				'dev-1629375638187-90104949233722',
				'nft_create_type',
				params,
				this.near.DEFAULT_GAS,
				'0.1'
			)

			return params
		} catch (err) {
			throw err
		}
	}
}

module.exports = Chapter

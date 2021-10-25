const nearAPI = require('near-api-js')
const nacl = require('tweetnacl')
const bs58 = require('bs58')
const sha256 = require('js-sha256')
const axios = require('axios')
const getConfig = require('../configs/near')
const { utils } = require('near-api-js')

const _hexToArr = (str) => {
	try {
		return new Uint8Array(
			str.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
		)
	} catch (err) {
		throw err
	}
}

class Near {
	constructor() {
		this.ctx = null
		this.config = getConfig(process.env.NODE_ENV)
	}

	async init() {
		this.keyStore = new nearAPI.keyStores.UnencryptedFileSystemKeyStore(
			`${process.env.HOME}/.near-credentials/`
		)
		const near = await nearAPI.connect({
			deps: {
				keyStore: this.keyStore,
			},
			...this.config,
		})
		this._ = near
		this.DEFAULT_GAS = nearAPI.DEFAULT_FUNCTION_CALL_GAS
	}

	async authSignature(authHeader, networkId = 'testnet') {
		try {
			const decodeAuthHeader = Buffer.from(authHeader, 'base64').toString()
			const [userId, pubKey, signature] = decodeAuthHeader.split('&')
			const pubKeyArr = _hexToArr(pubKey)
			const signatureArr = _hexToArr(signature)
			const hash = new Uint8Array(sha256.sha256.array(userId))
			const verify = nacl.sign.detached.verify(hash, signatureArr, pubKeyArr)
			if (!verify) {
				throw new Error('unauthorized')
			}
			const b58pubKey = bs58.encode(Buffer.from(pubKey.toUpperCase(), 'hex'))
			const response = await axios.post(this.config.nodeUrl, {
				jsonrpc: '2.0',
				id: 'dontcare',
				method: 'query',
				params: {
					request_type: 'view_access_key',
					finality: 'final',
					account_id: userId,
					public_key: `ed25519:${b58pubKey}`,
				},
			})

			if (response.data.result && response.data.result.error) {
				console.log(response.data.result.error)
				throw new Error('unauthorized')
			}
			return userId
		} catch (err) {
			return null
		}
	}

	async functionCall(
		accountId,
		contract,
		method,
		params,
		gas = '50000000000000',
		deposit
	) {
		const account = await this._.account(accountId)
		return await account.functionCall({
			contractId: contract,
			methodName: method,
			args: params,
			gas: gas,
			attachedDeposit: utils.format.parseNearAmount(deposit),
		})
	}
}

module.exports = Near

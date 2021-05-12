const request = require('request')
const fs = require('fs')

const {getOauthToken, makeRequest} = require('./core')
const {getUploadAlbumId} = require('./album')
const {tryWithBackoff} = require('../utils')

let albumId = 'not populated yet'

async function init() {
	albumId = await getUploadAlbumId()
}

async function upload(referencePath, filePath) {
	let oauthToken = await getOauthToken()
	let uploadToken = await uploadContents(oauthToken, referencePath, filePath)
	await tryWithBackoff(
		30,
		300,
		async () => {
			await registerUpload(oauthToken, uploadToken, referencePath)
		},
		'during upload'
	)
}

async function uploadContents(oauthToken, referencePath, filePath) {
	let uploadToken = await new Promise(function (resolve, reject) {
		let input = fs.createReadStream(filePath)
		let output = request.post(
			'https://photoslibrary.googleapis.com/v1/uploads',
			{
				headers: {
					'Content-type': 'application/octet-stream',
					Authorization: `Bearer ${oauthToken}`,
					'X-Goog-Upload-File-Name': filePath,
					'X-Goog-Upload-Protocol': 'raw'
				}
			},
			(error, response, uploadToken) => {
				if (!error && response.statusCode == 200) {
					resolve(uploadToken)
				} else {
					console.error(error)
					console.error(response)
					console.error(uploadToken)
					console.log(`Failed staging ${referencePath}`)
					reject(error)
				}
			}
		)
		input.pipe(output)
	})
	return uploadToken
}

async function registerUpload(oauthToken, uploadToken, referencePath) {
	let url = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate'
	let contentType = 'application/json'
	let body = JSON.stringify(
		{
			albumId: albumId,
			newMediaItems: [
				{
					simpleMediaItem: {
						uploadToken: uploadToken,
						fileName: referencePath
					}
				}
			]
		},
		null,
		2
	)
	try {
		await makeRequest('POST', url, body, contentType, oauthToken)
		console.log(`Uploaded ${referencePath}`)
	} catch (e) {
		console.log(`Failed uploading ${referencePath}`)
		throw e
	}
}

module.exports = {upload, init}

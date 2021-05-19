const request = require('request')
const fs = require('fs')
const _ = require('underscore')

const {getOauthToken, makeRequest} = require('./core')
const {getUploadAlbumId, deletePhotos, cancelDeletes} = require('./album')

let albumId = 'not populated yet'

async function init() {
	albumId = await getUploadAlbumId()
}

async function upload(paths) {
	let oauthToken = await getOauthToken()
	let referencePaths = paths.map(path => path[0])
	let deletedMediaItemIds = await deletePhotos(referencePaths)
	let uploads = []
	for ([referencePath, outputPath] of paths) {
		let uploadToken = await uploadContents(oauthToken, referencePath, outputPath)
		uploads.push({referencePath, uploadToken})
	}
	let uploadedIds = await registerUploads(oauthToken, uploads)
	let idsToCancelDeletes = _.intersection(deletedMediaItemIds, uploadedIds)
	await cancelDeletes(idsToCancelDeletes) //TODO this doesn't seem to work
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

async function registerUploads(oauthToken, paths) {
	let url = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate'
	let contentType = 'application/json'
	let mediaItems = paths.map(path => {
		return {
			simpleMediaItem: {
				uploadToken: path.uploadToken,
				fileName: path.referencePath
			}
		}
	})
	const chunks = _.chunk(mediaItems, 50)
	let uploadedIds = []
	for (chunk of chunks) {
		let body = JSON.stringify({
			albumId: albumId,
			newMediaItems: chunk
		})
		try {
			let response = await makeRequest(`registering upload`, 'POST', url, body, contentType, oauthToken)
			console.log(`Uploaded ${chunk.length} items.`)
			console.log(response)
			const chunkUploadedIds = response.newMediaItemResults.map(item => item.mediaItem.id)
			uploadedIds = uploadedIds.concat(chunkUploadedIds)
		} catch (e) {
			console.log(`Failed uploading ${chunk}`)
			throw e
		}
	}
	return uploadedIds
}

module.exports = {upload, init}

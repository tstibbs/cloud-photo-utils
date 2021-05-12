require('dotenv').config()
const {getOauthToken, makeRequest} = require('./core')

const stagingAlbumTitle = process.env.google_staging_album_title //must be the title of an album created through this app
const deleteAlbumTitle = process.env.google_delete_album_title //must be the title of an album created through this app

let fullPhotosList = null // should be initialised in init
let deleteAlbumId = null // should be initialised in init

async function init() {
	fullPhotosList = await fetchCurrentPhotosList()
	deleteAlbumId = await getAlbumId(deleteAlbumTitle)
}

async function fetchCurrentPhotosList() {
	let oauthToken = await getOauthToken()
	let url = ''
	try {
		await makeRequest('GET', url, null, contentType, oauthToken)
	} catch (e) {
		console.log(`Failed listing current photos`)
		throw e
	}
}

async function fetchCurrentPhotosList() {
	const oauthToken = await getOauthToken()
	const baseUrl = 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100'
	const contentType = null
	const body = null
	try {
		let mediaItems = []
		await page(baseUrl, async url => {
			let rawResponse = await makeRequest('GET', url, body, contentType, oauthToken)
			let response = JSON.parse(rawResponse)
			if (response.mediaItems != null) {
				mediaItems = mediaItems.concat(...response.mediaItems)
			}
			return response
		})
		let items = Object.fromEntries(mediaItems.map(mediaItem => [mediaItem.filename, mediaItem.id]))
		return items
	} catch (e) {
		console.log(`Failed fetching full list of items in google photos.`)
		throw e
	}
}

async function createAlbums() {
	await createAlbum(stagingAlbumTitle)
	await createAlbum(deleteAlbumTitle)
}

async function createAlbum(albumTitle) {
	let oauthToken = await getOauthToken()
	let url = 'https://photoslibrary.googleapis.com/v1/albums'
	let contentType = 'application/json'
	let body = JSON.stringify(
		{
			album: {
				title: albumTitle
			}
		},
		null,
		2
	)
	try {
		await makeRequest('POST', url, body, contentType, oauthToken)
		console.log(`Created album ${albumTitle}`)
	} catch (e) {
		console.log(`Failed creating album ${albumTitle}`)
		throw e
	}
}

async function getUploadAlbumId() {
	return await getAlbumId(stagingAlbumTitle)
}

async function getAlbumId(albumTitle) {
	const oauthToken = await getOauthToken()
	const baseUrl = 'https://photoslibrary.googleapis.com/v1/albums?pageSize=50'
	const contentType = null
	const body = null
	try {
		let albums = []
		await page(baseUrl, async url => {
			let rawResponse = await makeRequest('GET', url, body, contentType, oauthToken)
			let response = JSON.parse(rawResponse)
			albums = albums.concat(response.albums)
			return response
		})
		let album = albums.filter(album => album != null && album.title == albumTitle)
		let albumId = album[0].id
		console.log(`Fetched album id for ${albumTitle}`)
		return albumId
	} catch (e) {
		console.log(`Failed fetching album id for ${albumTitle}`)
		throw e
	}
}

async function deletePhotos(referencePaths) {
	const mediaItemIds = referencePaths.map(referencePath => fullPhotosList[referencePath]).filter(id => id != null)
	if (mediaItemIds.length != referencePaths.length) {
		console.log(
			`Only ${mediaItemIds.length} out of ${
				referencePaths.length
			} reference paths were found in existing photos list (i.e. ${
				referencePaths.length - mediaItemIds.length
			} new photos).`
		)
	}
	if (mediaItemIds.length > 0) {
		let oauthToken = await getOauthToken()
		let url = `https://photoslibrary.googleapis.com/v1/albums/${deleteAlbumId}:batchAddMediaItems`
		let contentType = 'application/json'
		let body = JSON.stringify(
			{
				mediaItemIds: mediaItemIds
			},
			null,
			2
		)
		try {
			await makeRequest('POST', url, body, contentType, oauthToken)
		} catch (e) {
			console.log(`Failed adding item to delete album ${albumTitle}`)
			throw e
		}
	} else {
		console.log(`None of the reference paths found in existing photos list.`)
	}
}

async function page(baseUrl, delegate) {
	let nextToken = null
	do {
		let url = baseUrl
		if (nextToken != null) {
			url = `${baseUrl}&pageToken=${nextToken}`
			nextToken = null
		}
		let response = await delegate(url)
		nextToken = response.nextPageToken
	} while (nextToken != null)
}

module.exports = {getUploadAlbumId, createAlbums, init, deletePhotos}

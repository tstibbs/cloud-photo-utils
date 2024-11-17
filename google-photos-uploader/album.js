import 'dotenv/config'
import _ from 'underscore'

import {getOauthToken, makeRequest} from './core.js'

const stagingAlbumTitle = process.env.google_staging_album_title //must be the title of an album created through this app
const deleteAlbumTitle = process.env.google_delete_album_title //must be the title of an album created through this app

let deleteAlbumId = null // should be initialised in init

async function init() {
	deleteAlbumId = await getAlbumId(deleteAlbumTitle)
}

async function fetchCurrentPhotosList() {
	const oauthToken = await getOauthToken()
	const baseUrl = 'https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100'
	const contentType = null
	const body = null
	try {
		let mediaItems = []
		await page(baseUrl, async url => {
			let response = await makeRequest('fetching current photos list', 'GET', url, body, contentType, oauthToken)
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
	let albums = await getPossibleAlbums(albumTitle)
	//check if album already exists
	if (albums.length == 0) {
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
			await makeRequest(`creating album ${albumTitle}`, 'POST', url, body, contentType, oauthToken)
			console.log(`Created album ${albumTitle}`)
		} catch (e) {
			console.log(`Failed creating album ${albumTitle}`)
			throw e
		}
	}
}

async function getUploadAlbumId() {
	return await getAlbumId(stagingAlbumTitle)
}

async function getAlbumId(albumTitle) {
	try {
		let albums = await getPossibleAlbums(albumTitle)
		if (albums.length != 0) {
			let albumId = albums[0].id
			console.log(`Fetched album id for ${albumTitle}`)
			return albumId
		} else {
			throw new Error(`Failed fetching album id for ${albumTitle}`)
		}
	} catch (e) {
		console.log(`Failed fetching album id for ${albumTitle}`)
		throw e
	}
}

async function getPossibleAlbums(albumTitle) {
	const oauthToken = await getOauthToken()
	const baseUrl = 'https://photoslibrary.googleapis.com/v1/albums?pageSize=50'
	const contentType = null
	const body = null
	try {
		let albums = []
		await page(baseUrl, async url => {
			let response = await makeRequest(
				`fetching album ids for ${albumTitle}`,
				'GET',
				url,
				body,
				contentType,
				oauthToken
			)
			albums = albums.concat(response.albums)
			return response
		})
		albums = albums.filter(album => album != null && album.title == albumTitle)
		return albums
	} catch (e) {
		console.log(`Failed fetching album id for ${albumTitle}`)
		throw e
	}
}

async function deletePhotos(referencePaths) {
	const fullPhotosList = await fetchCurrentPhotosList()
	const mediaItemIds = referencePaths.map(referencePath => fullPhotosList[referencePath]).filter(id => id != null)
	if (mediaItemIds.length != referencePaths.length) {
		console.log(
			`Only ${mediaItemIds.length} out of ${
				referencePaths.length
			} reference paths were found in existing photos list (i.e. ${
				referencePaths.length - mediaItemIds.length
			} new photos).`
		)
		console.log('referencePaths')
		console.log(JSON.stringify(referencePaths))
		console.log('fullPhotosList')
		console.log(JSON.stringify(fullPhotosList))
	}
	if (mediaItemIds.length > 0) {
		console.log(JSON.stringify(mediaItemIds, null, 2))
		const chunks = _.chunk(mediaItemIds, 50)
		let oauthToken = await getOauthToken()
		let url = `https://photoslibrary.googleapis.com/v1/albums/${deleteAlbumId}:batchAddMediaItems`
		let contentType = 'application/json'
		for (const chunk of chunks) {
			let body = JSON.stringify({
				mediaItemIds: chunk
			})
			try {
				await makeRequest(`adding deleted items to ${deleteAlbumId}`, 'POST', url, body, contentType, oauthToken)
			} catch (e) {
				console.log(`Failed adding item to delete album ${deleteAlbumId}`)
				throw e
			}
		}
	} else {
		console.log(`None of the reference paths found in existing photos list.`)
	}
	return mediaItemIds
}

async function cancelDeletes(uploadedIds) {
	//if the item to be uploaded is literally identical to a previous item then it won't upload a new one,
	// - so the item will appear in both staging and delete
	// - so if you then delete everything in the delete album then you'll delete some things that have in theory just been uploaded
	if (uploadedIds.length > 0) {
		const chunks = _.chunk(uploadedIds, 50)
		let oauthToken = await getOauthToken()
		let url = `https://photoslibrary.googleapis.com/v1/albums/${deleteAlbumId}:batchRemoveMediaItems`
		let contentType = 'application/json'
		for (const chunk of chunks) {
			let body = JSON.stringify({
				mediaItemIds: chunk
			})
			try {
				await makeRequest(`removing deleted items from ${deleteAlbumId}`, 'POST', url, body, contentType, oauthToken)
			} catch (e) {
				console.log(`Failed removing item from album ${deleteAlbumId}`)
				throw e
			}
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

export {getUploadAlbumId, createAlbums, init, deletePhotos, cancelDeletes}

require('dotenv').config()
const google_client_id = process.env.google_client_id
const google_project_id = process.env.google_project_id
const google_client_secret = process.env.google_client_secret
const albumTitle = process.env.google_album_title //must be the title of an album created through this app

//=====================================================

const fs = require('fs');
const {google} = require('googleapis');
const request = require('request');
const {readFile, writeFile, tryWithBackoff} = require('../utils')

const SCOPES = ['https://www.googleapis.com/auth/photoslibrary.appendonly', 'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata'];

const credentials = {
	"installed": {
		"client_id": google_client_id,
		"project_id": google_project_id,
		"auth_uri":"https://accounts.google.com/o/oauth2/auth",
		"token_uri":"https://oauth2.googleapis.com/token",
		"auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs",
		"client_secret": google_client_secret,
		"redirect_uris":["urn:ietf:wg:oauth:2.0:oob","http://localhost"]
	}
};

const authClient = new google.auth.OAuth2(credentials.installed.client_id, credentials.installed.client_secret, "http://localhost/success");

if (!module.parent) { //i.e. if being invoked directly on the command line
	let allArgs = process.argv.slice(2);
	if (allArgs.length == 1 && allArgs[0] == 'login') {
		console.log(buildAuthUrl());
	} else if (allArgs.length == 2 && allArgs[0] == 'success') {
		handleToken(allArgs[1]);
	} else if (allArgs.length == 2 && allArgs[0] == 'upload') {
		upload(allArgs[1]);
	} else if (allArgs.length == 1 && allArgs[0] == 'create-album') {
		createAlbum();
	} else {
		let command = `${process.argv[0]}`.split(/(\/|\\)/).slice(-1)[0]
		let module = `${process.argv[1]}`.split(/(\/|\\)/).slice(-1)[0]
		console.error(`Usage:
    ${command} ${module} login
    ${command} ${module} success code-from-url
    ${command} ${module} upload file-path
    ${command} ${module} create-album album-name`)
	}
}

let albumId = 'not populated yet'

async function init() {
	albumId = await getAlbumId()
}

function buildAuthUrl() {
	//use the referrer to find the right origin and then pass the right redirect url. Possibly cache the initial client objects?
	return authClient.generateAuthUrl({
		scope: SCOPES
	});
}

async function writeAuth(tokens) {
	return await writeFile('tmp/auth.json', JSON.stringify(tokens, null, 2))
}

async function handleToken(code) {
	//probably doesn't matter if we use one configured with the right redirect url or not in this case
	let res = await authClient.getToken(code)
	let tokens = res.tokens;
	console.log(tokens);
	await writeAuth(tokens);
}

async function upload(referencePath, filePath) {
	let oauthToken = await getOauthToken()
	let uploadToken = await uploadContents(oauthToken, referencePath, filePath);
	await tryWithBackoff(30, 300, async () => {
		await registerUpload(oauthToken, uploadToken, referencePath)
	}, "during upload")
}

async function uploadContents(oauthToken, referencePath, filePath) {
	let uploadToken = await new Promise(function(resolve, reject) {
		let input = fs.createReadStream(filePath);
		let output = request.post('https://photoslibrary.googleapis.com/v1/uploads', {
			headers: {
				'Content-type': 'application/octet-stream',
				'Authorization': `Bearer ${oauthToken}`,
				'X-Goog-Upload-File-Name': filePath,
				'X-Goog-Upload-Protocol': 'raw'
			}
		}, (error, response, uploadToken) => {
			if (!error && response.statusCode == 200) {
				resolve(uploadToken)
			} else {
				console.error(error);
				console.error(response);
				console.error(uploadToken);
				console.log(`Failed staging ${referencePath}`)
				reject(error)
			}
		});
		input.pipe(output);
	})
	return uploadToken
}

async function registerUpload(oauthToken, uploadToken, referencePath) {
	let url = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate'
	let contentType = 'application/json'
	let body = JSON.stringify({
		"albumId": albumId,
		"newMediaItems": [
			{
				"simpleMediaItem": {
					"uploadToken": uploadToken,
					fileName: referencePath
				}
			}
		]
	}, null, 2);
	try {
		await makeRequest('POST', url, body, contentType, oauthToken)
		console.log(`Uploaded ${referencePath}`)
	} catch (e) {
		console.log(`Failed uploading ${referencePath}`)
		throw e
	}
}

async function createAlbum() {
	let oauthToken = await getOauthToken()
	let url = 'https://photoslibrary.googleapis.com/v1/albums'
	let contentType = 'application/json'
	let body = JSON.stringify({
		"album": {
			"title": albumTitle
		}
	}, null, 2);
	try {
		await makeRequest('POST', url, body, contentType, oauthToken)
		console.log(`Created album ${albumTitle}`)
	} catch (e) {
		console.log(`Failed creating album ${albumTitle}`)
		throw e
	}
}

async function getAlbumId() {
	let oauthToken = await getOauthToken()
	let baseUrl = 'https://photoslibrary.googleapis.com/v1/albums?pageSize=50'
	let contentType = null
	let body = null
	try {
		let nextToken = null
		let albums = []
		do {
			let url = baseUrl
			if (nextToken != null) {
				url = `${baseUrl}&pageToken=${nextToken}`
				nextToken = null
			}
			let rawResponse = await makeRequest('GET', url, body, contentType, oauthToken)
			let response = JSON.parse(rawResponse)
			albums = albums.concat(response.albums)
			nextToken = response.nextPageToken
		} while (nextToken != null);
		let album = albums.filter(album => album != null && album.title == albumTitle)
		let albumId = album[0].id
		console.log(`Fetched album id for ${albumTitle}`)
		return albumId
	} catch (e) {
		console.log(`Failed fetching album id for ${albumTitle}`)
		throw e
	}
}

async function getOauthToken() {
	let contents = await readFile('tmp/auth.json')
	let auth = JSON.parse(contents);
	let expiryDate = new Date(auth.expiry_date);
	expiryDate.setMinutes(expiryDate.getMinutes() - 5)//allow ourselves some time to get the upload done before this expires
	if (expiryDate < Date.now()) {
		console.log('refreshing token');
		let data = await authClient.refreshToken(auth.refresh_token)
		console.log(data.tokens);
		auth.access_token = data.tokens.access_token;
		auth.expiry_date = data.tokens.expiry_date;
		await writeAuth(auth);
	}
	return auth.access_token
}

async function makeRequest(method, url, requestBody, contentType, oauthToken) {
	let headers = {
		'Authorization': `Bearer ${oauthToken}`
	}
	if (contentType != null) {
		headers['Content-type'] = contentType
	}
	return new Promise(function(resolve, reject) {
		request({
			method,
			uri: url,
			headers: headers,
			body: requestBody
		}, (error, response, body) => {
			if (!error && response.statusCode == 200) {
				resolve(body)
			} else {
				console.error(body);
				reject(error)
			}
		});
	})
}

module.exports = {
	init,
	upload
}

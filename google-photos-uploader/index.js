require('dotenv').config()
const google_client_id = process.env.google_client_id
const google_project_id = process.env.google_project_id
const google_client_secret = process.env.google_client_secret

//=====================================================

const fs = require('fs');
const {google} = require('googleapis');
const request = require('request');
const {readFile, writeFile} = require('../utils')

const SCOPES = ['https://www.googleapis.com/auth/photoslibrary.appendonly'];

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
	} else {
		let command = `${process.argv[0]}`.split(/(\/|\\)/).slice(-1)[0]
		let module = `${process.argv[1]}`.split(/(\/|\\)/).slice(-1)[0]
		console.error(`Usage:
    ${command} ${module} login
    ${command} ${module} success code-from-url
    ${command} ${module} upload file-path`)
	}
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

async function upload(path) {
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
	
	await uploadContents(auth.access_token, path);
}

async function uploadContents(oauthToken, fileName) {
	let uploadToken = await new Promise(function(resolve, reject) {
		let input = fs.createReadStream(fileName);
		let output = request.post('https://photoslibrary.googleapis.com/v1/uploads', {
			headers: {
				'Content-type': 'application/octet-stream',
				'Authorization': `Bearer ${oauthToken}`,
				'X-Goog-Upload-File-Name': fileName,
				'X-Goog-Upload-Protocol': 'raw'
			}
		}, (error, response, uploadToken) => {
			if (!error && response.statusCode == 200) {
				console.log(uploadToken);
				resolve(uploadToken)
			} else {
				console.error(error);
				console.error(response);
				console.error(uploadToken);
				reject(error)
			}
		});
		input.pipe(output);
	})
	await registerUpload(oauthToken, uploadToken, fileName);
}

async function registerUpload(oauthToken, uploadToken, fileName) {
	return new Promise(function(resolve, reject) {
		let body = JSON.stringify({
			//"albumId": "",//doesn't work unless this 'app' (i.e. these oauth credentials) created the album
			"newMediaItems": [
				{
					"description": fileName,
					"simpleMediaItem": {
						"uploadToken": uploadToken
					}
				}
			]
		}, null, 2);
		let output = request.post('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', {
			headers: {
				'Content-type': 'application/json',
				'Authorization': `Bearer ${oauthToken}`
			},
			body: body
		}, (error, response, body) => {
			if (!error && response.statusCode == 200) {
				console.log(body);
				resolve()
			} else {
				console.error(error);
				console.error(response);
				console.error(body);
				reject(error)
			}
		});
	})
}

module.exports = {
	upload
}

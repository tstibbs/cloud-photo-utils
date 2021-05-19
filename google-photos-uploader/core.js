require('dotenv').config()
const google_client_id = process.env.google_client_id
const google_project_id = process.env.google_project_id
const google_client_secret = process.env.google_client_secret

//=====================================================
const {google} = require('googleapis')
const request = require('request')
const {readFile, writeFile, tryWithBackoff} = require('../utils')
const SCOPES = ['https://www.googleapis.com/auth/photoslibrary']

const credentials = {
	installed: {
		client_id: google_client_id,
		project_id: google_project_id,
		auth_uri: 'https://accounts.google.com/o/oauth2/auth',
		token_uri: 'https://oauth2.googleapis.com/token',
		auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
		client_secret: google_client_secret,
		redirect_uris: ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost']
	}
}

const authClient = new google.auth.OAuth2(
	credentials.installed.client_id,
	credentials.installed.client_secret,
	'http://localhost/success'
)

function buildAuthUrl() {
	//use the referrer to find the right origin and then pass the right redirect url. Possibly cache the initial client objects?
	return authClient.generateAuthUrl({
		scope: SCOPES
	})
}

async function writeAuth(tokens) {
	return await writeFile('tmp/auth.json', JSON.stringify(tokens, null, 2))
}

async function handleToken(code) {
	//probably doesn't matter if we use one configured with the right redirect url or not in this case
	let res = await authClient.getToken(code)
	let tokens = res.tokens
	console.log(tokens)
	await writeAuth(tokens)
}

async function getOauthToken() {
	let contents = await readFile('tmp/auth.json')
	let auth = JSON.parse(contents)
	let expiryDate = new Date(auth.expiry_date)
	expiryDate.setMinutes(expiryDate.getMinutes() - 5) //allow ourselves some time to get the upload done before this expires
	if (expiryDate < Date.now()) {
		console.log('refreshing token')
		let data = await authClient.refreshToken(auth.refresh_token)
		console.log(data.tokens)
		auth.access_token = data.tokens.access_token
		auth.expiry_date = data.tokens.expiry_date
		await writeAuth(auth)
	}
	return auth.access_token
}

async function makeRawRequest(requestProps) {
	return new Promise(function (resolve, reject) {
		request(requestProps, (error, response, body) => {
			if (!error && response.statusCode == 200) {
				resolve(body)
			} else {
				console.error(body)
				reject(error)
			}
		})
	})
}

async function makeRequest(description, method, url, requestBody, contentType, oauthToken) {
	let headers = {
		Authorization: `Bearer ${oauthToken}`
	}
	if (contentType != null) {
		headers['Content-type'] = contentType
	}
	let requestProps = {
		method,
		uri: url,
		headers: headers
	}
	if (requestBody != null) {
		requestProps.body = requestBody
	}
	let rawResponse = await tryWithBackoff(
		30,
		300,
		async () => {
			return await makeRawRequest(requestProps)
		},
		description
	)
	if (rawResponse != null && rawResponse.length > 0) {
		return JSON.parse(rawResponse)
	} else {
		return rawResponse
	}
}

module.exports = {
	buildAuthUrl,
	handleToken,
	getOauthToken,
	makeRequest
}

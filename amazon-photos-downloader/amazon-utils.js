import 'dotenv/config'

import axios from 'axios'
import assert from 'assert'

const sessionid = process.env.amazon_session_id
const cookie = process.env.amazon_cookie

export const axiosInstance = axios.create({
	baseURL: 'https://www.amazon.co.uk/drive/v1/',
	headers: {
		'x-amzn-sessionid': sessionid,
		cookie: cookie,
		'user-agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36'
	}
})

export async function request(url, options) {
	let response = await axiosInstance.get(url, options)
	return response.data
}

export async function fetchPages(url, startToken) {
	let requestUrl = url
	if (startToken != null) {
		requestUrl = `${url}&startToken=${startToken}`
	}
	let response = await request(requestUrl)
	if (typeof response !== 'object') {
		console.log(response)
		throw new Error('Unexpected response type')
	}
	let data = response.data
	if (response.nextToken != null) {
		let response2 = await fetchPages(url, response.nextToken)
		data = data.concat(response2)
	}
	return data
}

function processFolderContents(data) {
	let entries = data.filter(item => item != undefined)
	let files = entries
		.filter(item => item.kind == 'FILE')
		.map(item => {
			assert(item.parentMap.FOLDER.length == 1)
			return {
				id: item.id,
				name: item.name,
				md5: item.contentProperties.md5,
				contentDate: item.contentProperties.contentDate,
				folder: item.parentMap.FOLDER[0]
			}
		})
	let folders = entries
		.filter(item => item.kind == 'FOLDER')
		.map(item => {
			return {
				id: item.id,
				name: item.name
			}
		})
	return {
		files,
		folders
	}
}

async function fetchParentFolders(allFolders, ids) {
	let parentFolderUrls = ids.map(folder => `nodes/${folder}`)

	let parentsToRequest = []
	let promises = parentFolderUrls.map(url => request(url))
	let results = await Promise.all(promises)
	results.forEach(result => {
		assert(result.parents.length <= 1)
		let parent = result.parents[0]
		if (parent != null) {
			parentsToRequest.push(parent)
		}
		let name = result.name
		if (name == null && result.isRoot == true) {
			name = ''
		}
		allFolders[result.id] = {
			name: name,
			parent: parent
		}
	})

	if (parentsToRequest.length > 0) {
		await fetchParentFolders(allFolders, parentsToRequest)
	}
}

function calcFolders(allFolders) {
	let entriesToBeFilled = Object.values(allFolders).filter(folder => folder.parent != undefined)
	if (entriesToBeFilled.length > 0) {
		Object.entries(allFolders)
			.filter(([id, folder]) => folder.parent == undefined)
			.forEach(([id, folder]) =>
				Object.entries(allFolders)
					.filter(([otherId, otherFolder]) => otherFolder.parent == id)
					.forEach(([otherId, otherFolder]) => {
						otherFolder.name = `${folder.name}/${otherFolder.name}`
						otherFolder.parent = undefined
					})
			)
		calcFolders(allFolders)
	}
}

function calcPaths(allFolders, files) {
	allFolders = Object.fromEntries(Object.entries(allFolders).map(([id, folder]) => [id, folder.name]))

	files.forEach(file => {
		let folder = file.folder
		if (folder in allFolders) {
			folder = allFolders[folder]
			file.name = `${folder}/${file.name}`
		}
	})
}

export async function listFolderPaths(folder) {
	let filesData = await fetchPages(
		`https://www.amazon.co.uk/drive/v1/nodes/${folder}/children?resourceVersion=V2`,
		null
	)
	let {files} = processFolderContents(filesData)
	let parentFolders = [...new Set(files.map(file => file.folder))].sort()
	let allFolders = {}
	await fetchParentFolders(allFolders, parentFolders)
	calcFolders(allFolders)
	calcPaths(allFolders, files)
	return files
}

export async function fetchFolderContents(folder) {
	let filesData = await fetchPages(`nodes/${folder}/children?resourceVersion=V2`, null)
	let filesAndFolders = processFolderContents(filesData)
	return filesAndFolders
}

export async function getRootId() {
	let results = await fetchPages(`nodes?filters=kind:FOLDER AND isRoot:true`)
	assert.strictEqual(results.length, 1)
	let rootResult = results[0]
	assert.strictEqual(rootResult.kind, 'FOLDER')
	assert.strictEqual(rootResult.isRoot, true)
	return rootResult.id
}

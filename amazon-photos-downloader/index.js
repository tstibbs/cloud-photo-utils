require('dotenv').config()
const folder = process.env.amazon_folder
const sessionid = process.env.amazon_session_id
const cookie = process.env.amazon_cookie

//=====================================================

const assert = require('assert')
const axios = require('axios')
const {writeFile} = require('../utils')

const axiosInstance = axios.create({
	baseURL: 'https://www.amazon.co.uk/drive/v1/',
	headers: {
		'x-amzn-sessionid': sessionid,
		'cookie': cookie,
		'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36'
	}
});

async function fetchPages(url, startToken) {
	let requestUrl = url
	if (startToken != null) {
		requestUrl = `${url}&startToken=${startToken}`
	}
	let response = await request(requestUrl)
	let data = response.data
	if (response.nextToken != null) {
		let response2 = await fetchPages(url, response.nextToken)
		data = data.concat(response2)
	}
	return data
}

function processFilesData(data) {
	let files = data
	.filter(item => item != undefined)
	.map(item => {
		assert(item.parentMap.FOLDER.length == 1)
		return {
			id: item.id,
			name: item.name,
			md5: item.contentProperties.md5,
			folder: item.parentMap.FOLDER[0]
		}
	})
	return files
}

async function request(url, options) {
	let response = await axiosInstance.get(url, options)
	return response.data
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
	let entriesToBeFilled = Object.values(allFolders)
	.filter(folder =>
		folder.parent != undefined
	);
	if (entriesToBeFilled.length > 0) {
		Object.entries(allFolders)
		.filter(([id, folder]) =>
			folder.parent == undefined
		).forEach(([id, folder]) =>
			Object.entries(allFolders)
			.filter(([otherId, otherFolder]) =>
				otherFolder.parent == id
			).forEach(([otherId, otherFolder]) => {
				otherFolder.name = `${folder.name}/${otherFolder.name}`
				otherFolder.parent = undefined
			})
		)
		calcFolders(allFolders)
	}
}

function calcPaths(allFolders, files) {
	allFolders = Object.fromEntries(Object.entries(allFolders)
	.map(([id, folder]) => [id, folder.name]))
		
	let paths = files.map(file => {
		let folder = file.folder
		if (folder in allFolders) {
			folder = allFolders[folder]
			file.name = `${folder}/${file.name}`
		}
		return [file.name, file.id]
	})
	return Object.fromEntries(paths)
}

async function listPaths() {
	let filesData = await fetchPages(`https://www.amazon.co.uk/drive/v1/nodes/${folder}/children?resourceVersion=V2`, null)
	let files = processFilesData(filesData)
	let parentFolders = [...new Set(files.map(file => file.folder))].sort()
	let allFolders = {}
	await fetchParentFolders(allFolders, parentFolders)
	calcFolders(allFolders)
	let paths = calcPaths(allFolders, files)
	return paths
}

async function download(ids) {
	let promises = ids.map(id =>
		request(`https://www.amazon.co.uk/drive/v1/nodes/${id}/contentRedirection`, {
			responseType: 'arraybuffer'
		})
	)
	let allData = await Promise.all(promises)
	//dump data to disk instead of trying to hold all downloaded images in memory
	let writePromises = allData.map((data, i) =>
		writeFile(`tmp/${ids[i]}.jpg`, data)
	)
	await Promise.all(writePromises)
}

if (!module.parent) { //i.e. if being invoked directly on the command line
	listPaths().then(paths => {
		console.log(JSON.stringify(paths, null, 2))
	})
}

module.exports = {
	listPaths,
	download
}

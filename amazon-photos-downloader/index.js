const folder = ''
const sessionid = ''
const cookie = ''

//=====================================================

const assert = require('assert')
const axios = require('axios')

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
	console.log(data.filter(item => item != undefined).length)
	let files = data
	.filter(item => item != undefined)
	.map(item => {
		assert(item.parentMap.FOLDER.length == 1)
		return {
			name: item.name,
			md5: item.contentProperties.md5,
			folder: item.parentMap.FOLDER[0]
		}
	})
	return files
}

async function request(url) {
	let response = await axiosInstance.get(url)
	return response.data
}

let allFolders = {}
	
async function fetchParentFolders(ids) {
	let parentFolderUrls = ids.map(folder => `nodes/${folder}`)

	let parentsToRequest = []
	let promises = parentFolderUrls.map(url => request(url))
	let results = await Promise.all(promises)
	results.forEach(result => {
		//console.log(result)
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
		await fetchParentFolders(parentsToRequest)
	}
	
}

function calcFolders() {
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
		calcFolders()
	}
}

function calcPaths(files) {
	calcFolders()

	allFolders = Object.fromEntries(Object.entries(allFolders)
	.map(([id, folder]) => [id, folder.name]))
		
	let paths = files.map(file => {
		let folder = file.folder
		if (folder in allFolders) {
			folder = allFolders[folder]
			file.name = `${folder}/${file.name}`
		}
		return file.name
	})
	return paths
}

async function main() {
	let filesData = await fetchPages(`https://www.amazon.co.uk/drive/v1/nodes/${folder}/children?resourceVersion=V2`, null)
	let files = processFilesData(filesData)
	let parentFolders = [...new Set(files.map(file => file.folder))].sort()
	await fetchParentFolders(parentFolders)
	let paths = calcPaths(files)
	console.log([...new Set(paths)].sort().join('\n'))
}
main()

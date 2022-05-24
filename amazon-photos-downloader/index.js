import 'dotenv/config'

import {listFolderPaths, request} from './amazon-utils.js'

import {writeFile} from '../utils.js'

const folder = process.env.amazon_folder

export async function download(ids) {
	let promises = ids.map(id =>
		request(`https://www.amazon.co.uk/drive/v1/nodes/${id}/contentRedirection`, {
			responseType: 'arraybuffer'
		})
	)
	let allData = await Promise.all(promises)
	//dump data to disk instead of trying to hold all downloaded images in memory
	let writePromises = allData.map((data, i) => writeFile(`tmp/${ids[i]}.jpg`, data))
	await Promise.all(writePromises)
}

export async function listPaths() {
	let files = await listFolderPaths(folder)
	return Object.fromEntries(files.map(file => [file.name, file.id]))
}

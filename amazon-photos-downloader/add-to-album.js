import {readFile} from 'fs/promises'

import esMain from 'es-main'

import {request, axiosInstance} from './amazon-utils.js'

async function processOneFile(filePath, albumId) {
	//search for something with that file name
	let fileName = filePath.split('/').slice(-1)
	let response = await request(`/nodes?filters=name:"${encodeURIComponent(fileName)}"`)
	let files = response.data
	if (files.length == 1) {
		let file = files[0]
		let fileId = file.id
		//add it to the album
		await axiosInstance.put(`/nodes/${albumId}/children/${encodeURIComponent(fileId)}?resourceVersion=V2`)
		console.log(`added ${filePath} (${fileId}) to ${albumId}`)
	} else {
		console.error(`file ${fileName} in ${filePath} found ${files.length} times.`)
		process.exitCode = 1
	}
}

async function processFiles(listPath, albumId) {
	let contents = await readFile(listPath)
	let files = contents
		.toString()
		.split('\n')
		.map(file => file.trim())
		.filter(file => file.length > 0)
	for (let file of files) {
		await processOneFile(file, albumId)
	}
}

export function showUsage() {
	console.log('Usage: node add-to-album.js <album id to add to> <file containing newline-seperated paths to find>')
	process.exit(1)
}

async function cli() {
	//i.e. if being invoked directly on the command line
	const args = process.argv.slice(2)
	if (args.length != 2) {
		showUsage()
	} else {
		let albumId = args[0]
		let pathsFile = args[1]
		await processFiles(pathsFile, albumId)
		console.log('finished')
	}
}

if (esMain(import.meta)) {
	await cli()
}

import {mkdir, writeFile} from 'fs/promises'
import assert from 'assert'

import esMain from 'es-main'
import {sortBy} from 'underscore'

import {getRootId, fetchPages, fetchFolderContents} from './amazon-utils.js'

const outputFolder = 'output/amz-md5-lists'

async function list(folderId, folderPath) {
	let {files, folders} = await fetchFolderContents(folderId)
	let prefix = ''
	if (folderPath != null) {
		prefix = folderPath + '/'
	}
	let results = files.map(({name, md5}) => ({
		name: prefix + name,
		md5
	}))
	if (folders.length > 0) {
		for await (let folder of folders) {
			let {id, name} = folder
			let fullPath = [folderPath, name].join('/')
			let folderResults = await list(id, fullPath)
			results = results.concat(folderResults)
		}
	}
	return results
}

async function listMd5s(folderId, folderPath) {
	let files = await list(folderId, folderPath)
	files = sortBy(files, 'name')
	return files.map(({name, md5}) => `${md5}  ${name}`).join('\n') + '\n'
}

async function findFolder(parentPath, folderPath) {
	let rootId = await getRootId()
	let pathElements = [...parentPath.split('/'), ...folderPath.split('/')]
	let parentId = rootId
	for (let pathElement of pathElements) {
		let url = `nodes?filters=kind:FOLDER AND name:"${encodeURIComponent(
			pathElement
		)}" AND parents:"${encodeURIComponent(parentId)}"`
		let results = await fetchPages(url)
		assert.strictEqual(results.length, 1, url)
		let folderResult = results[0]
		parentId = folderResult.id
	}
	return parentId // the last set parentId is in fact the id of the last folder in the path
}

async function writeResults(parentPath, folderPath, results) {
	let outputPath = `${outputFolder}/${parentPath}`
	await mkdir(outputPath, {
		recursive: true
	})
	let fileName = folderPath.replace(/\//g, '__') // remove the slashes
	await writeFile(`${outputPath}/${fileName}.md5`, results)
}

function showUsage() {
	console.log('Usage: node list-checksums.js "parent folder path" "folder path to include in output"')
	process.exit(1)
}

async function cli() {
	const args = process.argv.slice(2)
	if (args.length != 2) {
		showUsage()
	} else {
		let parentPath = args[0]
		let folderPath = args[1]
		let folderId = await findFolder(parentPath, folderPath) //find the starting folder
		let results = await listMd5s(folderId, folderPath)
		await writeResults(parentPath, folderPath, results)
	}
}

if (esMain(import.meta)) {
	//i.e. if being invoked directly on the command line
	await cli()
}

//move files from one folder to another in amazon drive. behaviour when moving between amazon photos albums is unknown.

import {readFile} from 'fs/promises'

import esMain from 'es-main'

import {axiosInstance} from './amazon-utils.js'

async function cli(fromFolder, toFolder, idsFile) {
	let fileContents = await readFile(idsFile)
	let ids = fileContents.toString().split('\n')
	for (let id of ids) {
		id = id.trim()
		if (id.length > 0) {
			await axiosInstance.post(`/nodes/${toFolder}/children?resourceVersion=V2`, {
				fromParent: fromFolder,
				childId: id
			})
		}
	}
}

function showUsage() {
	console.log('Usage: node move-files.js <from folder id> <to folder id> <name of file containing list of ids to move>')
	process.exit(1)
}

if (esMain(import.meta)) {
	//i.e. if being invoked directly on the command line
	const args = process.argv.slice(2)
	if (args.length != 3) {
		showUsage()
	} else {
		let fromFolder = args[0]
		let toFolder = args[1]
		let idsFile = args[2]
		await cli(fromFolder, toFolder, idsFile)
	}
}

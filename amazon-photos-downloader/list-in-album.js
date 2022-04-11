import esMain from 'es-main'

import {listFolderPaths} from './amazon-utils.js'

export function showUsage() {
	console.log('Usage: node list-in-album.js <album id>')
	process.exit(1)
}

if (esMain(import.meta)) {
	//i.e. if being invoked directly on the command line
	const args = process.argv.slice(2)
	if (args.length != 1) {
		showUsage()
	} else {
		let album = args[0]
		let paths = await listFolderPaths(album)
		console.log(JSON.stringify(paths, null, 2))
	}
}

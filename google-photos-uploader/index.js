import esMain from 'es-main'

import {buildAuthUrl, handleToken} from './core.js'
import {upload, init as uploadInit} from './upload.js'
import {createAlbums, init as albumInit, deletePhotos} from './album.js'

if (esMain(import.meta)) {
	//i.e. if being invoked directly on the command line
	let allArgs = process.argv.slice(2)
	if (allArgs.length == 1 && allArgs[0] == 'login') {
		console.log(buildAuthUrl())
	} else if (allArgs.length == 2 && allArgs[0] == 'success') {
		handleToken(allArgs[1])
	} else if (allArgs.length == 2 && allArgs[0] == 'upload') {
		upload(allArgs[1])
	} else if (allArgs.length == 1 && allArgs[0] == 'create-albums') {
		createAlbums()
	} else {
		let command = `${process.argv[0]}`.split(/(\/|\\)/).slice(-1)[0]
		let module = `${process.argv[1]}`.split(/(\/|\\)/).slice(-1)[0]
		console.error(`Usage:
    ${command} ${module} login
    ${command} ${module} success code-from-url
    ${command} ${module} upload file-path
    ${command} ${module} create-albums`)
	}
}

async function init() {
	await uploadInit()
	await albumInit()
}

export {init, upload, deletePhotos}

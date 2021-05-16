const fs = require('fs')
const util = require('util')

const setTimeoutPromised = util.promisify(setTimeout)
const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const mkdir = util.promisify(fs.mkdir)
const access = util.promisify(fs.access)

async function fileExists(path) {
	try {
		await access(path)
		return true
	} catch (e) {
		if (e.code == 'ENOENT') {
			return false
		} else {
			throw e
		}
	}
}

async function sleep(seconds) {
	await setTimeoutPromised(seconds * 1000)
}

async function tryWithBackoff(time, max, action, description) {
	try {
		return await action()
	} catch (e) {
		console.error(e)
		console.error(`Failed ${description}, sleeping ${time}s then retrying`)
		await sleep(time)
		let nextTime = time * 2
		if (nextTime <= max) {
			return await tryWithBackoff(nextTime, max, action, description)
		} else {
			throw e
		}
	}
}

module.exports = {
	readdir,
	readFile,
	writeFile,
	mkdir,
	fileExists,
	sleep,
	tryWithBackoff
}

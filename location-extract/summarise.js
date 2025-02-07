import {resolve} from 'path'
import {readFile, writeFile} from 'fs/promises'
import {promisify} from 'node:util'
import {execFile as rawExecFile} from 'node:child_process'

import {groupBy} from 'underscore'

const execFile = promisify(rawExecFile)

const locationsFileSuffix = '.locations.csv'
const latRoundDigits = 5
const lonRoundDigits = 4

let appArgs = process.argv.slice(2)
if (appArgs.length != 1) {
	console.error('Usage: node summarise.js baseDir') //doesn't matter if baseDir ends in a slash or not
	process.exit(1)
}
const baseDir = appArgs[0]

const {stdout, stderr} = await execFile('find', ['.', '-type', 'f', '-name', `*${locationsFileSuffix}`], {cwd: baseDir})
if (stderr != null && stderr.trim().length > 0) {
	console.log('stderr:')
	console.log(stderr)
}

const files = stdout
	.split('\n')
	.filter(line => line.length > 0)
	.map(line => line.trim())

const parentFolders = files.map(file => {
	file = file.endsWith(locationsFileSuffix) ? file.slice(0, -locationsFileSuffix.length) : file
	const parentFolder = resolve(baseDir, file)
	let baseDirMatches = /^\/mnt\/(\w+)\/(.*)$/.exec(parentFolder)
	let webFolderName = baseDirMatches == null ? parentFolder : `${baseDirMatches[1]}:/${baseDirMatches[2]}`
	webFolderName = `file:///${webFolderName}`
	return webFolderName
})

function trimCurrentDir(filePath) {
	return filePath.startsWith('./') ? filePath.substring(2) : filePath
}

let filePromises = files.map(file => readFile(resolve(baseDir, file), {encoding: 'utf8'}))
let results = await Promise.all(filePromises)
let entries = results.map(result => result.split('\n').filter(line => line.length > 0))
//parse csv - TODO use a proper CSV parser
entries = entries
	.map((fileEntries, i) =>
		fileEntries
			.map(line => line.split(','))
			.map(([file, lat, lon]) => ({
				path: parentFolders[i] + `/` + trimCurrentDir(file),
				lat: parseFloat(lat),
				lon: parseFloat(lon)
			}))
	)
	.flat()
const allEntriesCount = entries.length
//some phones set 0/0 at the lat/long if there's no geo info, which isn't helpful, but we'll remove as it's far more likely to be this than that the photo was actually taken at 0/0.
entries = entries.filter(({lat, lon}) => lat != 0 || lon != 0)
//now remove anything invalid
entries = entries.filter(({lat, lon}) => lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
const filteredEntriescount = entries.length

//round everything to a fixed precision
entries.forEach(entry => {
	entry.loc = entry.lat.toFixed(latRoundDigits) + ',' + entry.lon.toFixed(lonRoundDigits)
})

//summarise by matches post-rounding (basically, un-intelligent clustering)
entries = groupBy(entries, 'loc')
const summarisedEntriesCount = Object.entries(entries).length

console.log(`${allEntriesCount} entries, filtered to ${filteredEntriescount}, summarised to ${summarisedEntriesCount}`)

//output to GPX

const wpts = Object.entries(entries)
	.map(([loc, values]) => {
		let [lat, lon] = loc.split(',')
		let links = values.map(({path}) => `<link href="${path}"></link>`).join('\n')
		return `<wpt lat="${lat}" lon="${lon}">
        <desc>${values.length}</desc>
		<links>
			${links}
		</links>
    </wpt>`
	})
	.join('\n')

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
    ${wpts}
</gpx>`
await writeFile('out.gpx', gpx)

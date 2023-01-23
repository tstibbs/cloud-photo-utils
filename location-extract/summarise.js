import {resolve, dirname} from 'path'
import {readFile, writeFile} from 'fs/promises'

import {groupBy} from 'underscore'

const latRoundDigits = 5
const lonRoundDigits = 4

const baseDir = ''

const files = [
	//TODO call out to find command
]

const parentFolders = files
	.map(file => resolve(baseDir, dirname(file)))
	.map(folder => {
		let baseDirMatches = /^\/mnt\/(\w+)\/(.*)$/.exec(folder)
		let webFolderName = baseDirMatches == null ? folder : `${baseDirMatches[1]}:/${baseDirMatches[2]}`
		webFolderName = `file:///${webFolderName}`
		return webFolderName
	})

let filePromises = files.map(file => readFile(resolve(baseDir, file), {encoding: 'utf8'}))
let results = await Promise.all(filePromises)
let entries = results.map(result => result.split('\n').filter(line => line.length > 0))
//parse csv - TODO use a proper CSV parser
entries = entries
	.map((fileEntries, i) =>
		fileEntries
			.map(line => line.split(','))
			.map(values => ({
				path: parentFolders[i] + `/` + values[0],
				lat: parseFloat(values[1]),
				lon: parseFloat(values[2])
			}))
	)
	.flat()
let allEntriesCount = entries.length
//some phones set 0/0 at the lat/long if there's no geo info, which isn't helpful, but we'll remove as it's far more likely to be this than that the photo was actually taken at 0/0.
entries = entries.filter(({lat, lon}) => lat != 0 || lon != 0)
//now remove anything invalid
entries = entries.filter(({lat, lon}) => lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
let invalidEntriesRemoved = allEntriesCount - entries.length
if (invalidEntriesRemoved) {
	console.log(`${invalidEntriesRemoved} invalid entries removed out of ${entries.length}`)
} else {
	console.log(`${entries.length} entries found.`)
}

//round everything to a fixed precision
entries.forEach(entry => {
	entry.loc = entry.lat.toFixed(latRoundDigits) + ',' + entry.lon.toFixed(lonRoundDigits)
})

//summarise by matches post-rounding (basically, un-intelligent clustering)
entries = groupBy(entries, 'loc')

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

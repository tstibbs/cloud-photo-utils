import {close as exifClose, getDataFromExif} from './exif.js'
import {init, close as geocodingClose, buildDescriptor} from './geocoding.js'
import {buildImage} from './textToImage.js'
import {storeGeoDetails} from '../debug-printer.js'

async function buildOverlays(realPath, referencePath) {
	let exifData = await getDataFromExif(realPath, referencePath)
	let {lat, lng, date} = exifData
	let locationDescriptor = null
	let details = null
	if (lat != null && lng != null) {
		details = await buildDescriptor(lat, lng)
		locationDescriptor = details.descriptor
	}
	storeGeoDetails(realPath, details)
	let {top, bottom} = buildImage(date, locationDescriptor)
	return {top, bottom, exifData}
}

async function close() {
	await exifClose()
	await geocodingClose()
}

export {buildOverlays, close, init}

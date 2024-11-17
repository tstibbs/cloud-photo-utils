import {promisify} from 'node:util'
import axios from 'axios'
import {readFile, writeFile, fileExists} from '../utils.js'
const sleep = promisify(setTimeout)

const useCache = process.env.use_cache == 'true'
const cachePath = 'tmp/geocodingCache.json'
let lastRequest = Date.now()

const element1Fields = [
	'tourism',
	'historic',
	'railway',
	'shop',
	'building',
	'wood',
	'amenity',
	'natural',
	'leisure',
	'road'
]
const element2Fields = ['village', 'town', 'suburb', 'residential']
const element3Fields = ['city', 'county']

const geoCodingResults = {}
let geoCodingCache = null
const geoCodingErrors = [] //when results from this time that differ from last time

async function init() {
	let loadFile = useCache || (await fileExists(cachePath))
	if (loadFile) {
		let raw = await readFile(cachePath)
		geoCodingCache = JSON.parse(raw)
	}
}

async function close() {
	if (!useCache) {
		await writeFile(cachePath, JSON.stringify(geoCodingResults, null, 2))
	}
	if (geoCodingErrors.length > 0) {
		console.error('geoCodingErrors:')
		console.error(geoCodingErrors.join('\n'))
	}
}

async function fetchDescriptor(lat, lng) {
	if (Date.now() - lastRequest < 1200) {
		await sleep(1200)
	}
	lastRequest = Date.now()
	let url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`
	let response = await axios.get(url, {
		headers: {
			'User-Agent': 'https://github.com/tstibbs/cloud-photo-utils'
		}
	})
	let data = response.data
	let address = data.address
	let chosenFields = chooseFields(address)
	let descriptor = chosenFields.join(', ')
	return {
		descriptor,
		lat,
		lng,
		url,
		address,
		chosenFields
	}
}

function chooseField(fieldNames, address) {
	let found = fieldNames.find(fieldName => address[fieldName] != null)
	return found
}

//this function is the core algorithm that decides how to display the textual representation of each location
function chooseFields(address) {
	let titleFieldKey = chooseField(element1Fields, address)
	let localityKey = chooseField(element2Fields, address)
	let areaKey = chooseField(element3Fields, address)
	if (localityKey == undefined && areaKey == 'city' && 'county' in address) {
		localityKey = 'city'
		areaKey = 'county'
	}
	let country = address.country != 'United Kingdom' ? address.country : null
	if (localityKey == null || areaKey == null) {
		console.error("Didn't find all the fields we expected:")
		console.error(`localityKey: ${localityKey}`)
		console.error(`areaKey: ${areaKey}`)
		console.error(address)
	}
	let titleField = address[titleFieldKey]
	let locality = address[localityKey]
	let area = address[areaKey]
	if (
		titleFieldKey == 'road' &&
		localityKey == 'suburb' &&
		areaKey == 'city' &&
		(address.county == null || !address[areaKey].includes(address.county))
	) {
		locality = null
	}
	if (titleField != null && titleField.includes(locality)) {
		locality = null
	} else if (titleField != null && titleField.includes(area)) {
		area = null
	} else if (locality != null && locality.includes(titleField)) {
		titleField = null
	} else if (locality != null && locality.includes(area)) {
		area = null
	} else if (area != null && area.includes(titleField)) {
		titleField = null
	} else if (area != null && area.includes(locality)) {
		locality = null
	}
	return [titleField, locality, area, country].filter(element => element != null)
}

async function buildDescriptor(lat, lng) {
	let historyKey = `${lat},${lng}`
	let descriptorAndDetails
	if (useCache) {
		descriptorAndDetails = geoCodingCache[historyKey]
		if (descriptorAndDetails == null) {
			throw Error(`Geocoding cache entry not found for: ${historyKey}`)
		}
	} else {
		descriptorAndDetails = await fetchDescriptor(lat, lng)
		geoCodingResults[historyKey] = descriptorAndDetails
		if (
			geoCodingCache != null &&
			geoCodingCache[historyKey] != null &&
			descriptorAndDetails.descriptor != geoCodingCache[historyKey].descriptor
		) {
			geoCodingErrors.push(`Expected ${geoCodingCache[historyKey].descriptor}; was ${descriptorAndDetails.descriptor}`)
		}
	}
	return descriptorAndDetails
}

export {buildDescriptor, chooseFields, init, close}

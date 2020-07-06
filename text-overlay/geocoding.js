const axios = require('axios');
const {readFile, writeFile, fileExists} = require('../utils')

const useCache = process.env.use_cache == 'true'
const cachePath = 'tmp/geocodingCache.json'

const geoCodingResults = {}
let geoCodingCache = null
const geoCodingErrors = []//when results from this time that differ from last time

async function init() {
    let loadFile = useCache || await fileExists(cachePath)
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

function parseField(...fields) {
    fields = fields.filter(item => item != undefined)
    let field = fields.length >= 0 ? fields[0] : null // 
    return field
}

async function fetchDescriptor(lat, lng) {
    let response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
    let data = response.data;
    let address = data.address
    let titleField = parseField(address.tourism, address.historic, address.railway, address.shop, address.building)
    let locality = parseField(address.village, address.town, address.suburb)
    let area = parseField(address.city, address.county)
    let country = address.country != 'United Kingdom' ? address.country : null
    if (locality == null || area == null) {
        console.error("Didn't find all the fields we expected:")
        console.error(`locality: ${locality}`)
        console.error(`area: ${area}`)
        console.error(data)
    }
    let descriptor = [titleField, locality, area, country].filter(item => item != null).join(', ')
    return descriptor
}

async function buildDescriptor(lat, lng) {
    let historyKey = `${lat},${lng}`
    let descriptor;
    if (useCache) {
        descriptor = geoCodingCache[historyKey]
        if (descriptor == null) {
            throw Error(`Geocoding cache entry not found for: ${historyKey}`)
        }
    } else {
        descriptor = await fetchDescriptor(lat, lng)
        geoCodingResults[historyKey] = descriptor
        if (geoCodingCache != null && geoCodingCache[historyKey] != null && descriptor != geoCodingCache[historyKey]) {
            geoCodingErrors.push(`Expected ${geoCodingCache[historyKey]}; was ${descriptor}`)
        }
    }
    return descriptor
}

module.exports = {
    buildDescriptor,
    init,
    close
}

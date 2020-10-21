const exif = require('./exif.js')
const geocoding = require('./geocoding.js')
const {buildImage} = require('./textToImage.js')
const {storeGeoDetails} = require('../debug-printer.js')

async function buildOverlays(filename) {
    let {lat, lng, date} = await exif.getDataFromExif(filename)
    let locationDescriptor = null
    let details = null
    if (lat != null && lng != null) {
        details = await geocoding.buildDescriptor(lat, lng)
        locationDescriptor = details.descriptor
    }
    storeGeoDetails(filename, details)
    let {top, bottom} = buildImage(date, locationDescriptor)
    return {top, bottom}
}

async function close() {
    await exif.close()
    await geocoding.close()
}

module.exports = {
    buildOverlays,
    init: geocoding.init,
    close
}

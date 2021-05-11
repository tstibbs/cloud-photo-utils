const exif = require('./exif.js')
const geocoding = require('./geocoding.js')
const {buildImage} = require('./textToImage.js')
const {storeGeoDetails} = require('../debug-printer.js')

async function buildOverlays(realPath, referencePath) {
    let exifData = await exif.getDataFromExif(realPath, referencePath)
    let {lat, lng, date} = exifData
    let locationDescriptor = null
    let details = null
    if (lat != null && lng != null) {
        details = await geocoding.buildDescriptor(lat, lng)
        locationDescriptor = details.descriptor
    }
    storeGeoDetails(realPath, details)
    let {top, bottom} = buildImage(date, locationDescriptor)
    return {top, bottom, exifData}
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

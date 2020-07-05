const exif = require('./exif.js')
const geocoding = require('./geocoding.js')
const {buildImage} = require('./textToImage.js')

async function buildOverlays(filename) {
    let {lat, lng, date} = await exif.getDataFromExif(filename)
    let locationDescriptor = null
    if (lat != null && lng != null) {
        locationDescriptor = await geocoding.buildDescriptor(lat, lng)
    }
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

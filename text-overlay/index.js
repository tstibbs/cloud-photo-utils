const exif = require('./exif.js')
const {buildDescriptor} = require('./geocoding.js')
const {buildImage} = require('./textToImage.js')

async function buildOverlays(filename) {
    let {lat, lng, date} = await exif.getDataFromExif(filename)
    let locationDescriptor = 'Location unknown'
    if (lat != null && lng != null) 
    {
        locationDescriptor = await buildDescriptor(lat, lng)
    }
    let {top, bottom} = buildImage(date, locationDescriptor)
    return {top, bottom}
}

module.exports = {
    buildOverlays,
    close: exif.close
}

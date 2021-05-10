const exiftool = require("exiftool-vendored").exiftool

async function getDataFromExif(filename) {
    let tags = await exiftool.read(filename)
    let lat = null
    let lng = null
    let date = null
    let dateTimeOriginal = null
    if (tags != null) {
        lat = tags.GPSLatitude//is decimal
        lng = tags.GPSLongitude//is decimal
        dateTimeOriginal = tags.DateTimeOriginal
        if (dateTimeOriginal != null) {
            let month = `${dateTimeOriginal.month}`.padStart(2, '0')
            let day = `${dateTimeOriginal.day}`.padStart(2, '0')
            date = `${day}/${month}/${dateTimeOriginal.year}`
        }
    }
    return {
        lat,
        lng,
        date,
        dateTimeOriginal
    }
}

async function writeExifData(filename, exifData) {
    await exiftool.write(filename, {
        DateTimeOriginal: exifData.dateTimeOriginal,
        GPSLatitude: exifData.lat,
        GPSLongitude: exifData.lng
    })
}

async function close() {
    await exiftool.end()
}

module.exports = {
    getDataFromExif,
    writeExifData,
    close
}

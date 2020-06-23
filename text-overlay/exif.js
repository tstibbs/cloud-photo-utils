const exiftool = require("exiftool-vendored").exiftool

async function getDataFromExif(filename) {
    let tags = await exiftool.read(filename)
    let lat = null
    let lng = null
    let date = null
    if (tags != null) {
        lat = tags.GPSLatitude//is decimal
        lng = tags.GPSLongitude//is decimal
        let original = tags.DateTimeOriginal
        if (original != null) {
            let month = `${original.month}`.padStart(2, '0')
            let day = `${original.day}`.padStart(2, '0')
            date = `${day}/${month}/${original.year}`
        }
    }
    return {
        lat,
        lng,
        date
    }
}

async function close() {
    await exiftool.end()
}

module.exports = {
    getDataFromExif,
    close
}

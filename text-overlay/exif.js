const exiftool = require("exiftool-vendored").exiftool

async function getDataFromExif(filename) {
    let tags = await exiftool.read(filename)
    let lat = tags.GPSLatitude//is decimal
    let lng = tags.GPSLongitude//is decimal
    let {year, month, day} = tags.DateTimeOriginal
    month = `${month}`.padStart(2, '0')
    day = `${day}`.padStart(2, '0')
    let date = `${day}/${month}/${year}`
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

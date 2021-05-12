const exiftool = require('exiftool-vendored').exiftool

async function getDataFromExif(realPath, referencePath) {
	let tags = await exiftool.read(realPath)
	let lat = null
	let lng = null
	let date = null
	let dateTimeOriginal = null
	if (tags != null) {
		lat = tags.GPSLatitude //is decimal
		lng = tags.GPSLongitude //is decimal
		dateTimeOriginal = tags.DateTimeOriginal
		if (dateTimeOriginal != null) {
			let month = `${dateTimeOriginal.month}`.padStart(2, '0')
			let day = `${dateTimeOriginal.day}`.padStart(2, '0')
			date = `${day}/${month}/${dateTimeOriginal.year}`
		}
	}
	if (date == null) {
		//try extracting it from the file path e.g. for photos recieved on whatsapp
		let matches = referencePath.match(/(\d{8})(_(\d{6}))?/)
		if (matches != null) {
			let datePart = matches[1]
			let year = `${datePart[0]}${datePart[1]}${datePart[2]}${datePart[3]}`
			let month = `${datePart[4]}${datePart[5]}`
			let day = `${datePart[6]}${datePart[7]}`
			day = `${year}:${month}:${day}`
			time = matches[3]
			if (time != null) {
				time = `${time[0]}${time[1]}:${time[2]}${time[3]}:${time[4]}${time[5]}`
			} else {
				time = '12:00:00'
			}
			//format is 2021:05:03 09:34:24 - the time is mandatory (that's why it's called Date*Time*Original)
			dateTimeOriginal = `${day} ${time}`
			date = `${day}/${month}/${year}?`
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

import text2png from 'text2png'

const dataTextSize = 50
const locationTextSize = 24

const defaultOptions = {
	localFontPath: 'text-overlay/tmp/googlesans-regular.ttf',
	localFontName: 'google-sans-regular',
	textColor: '#FFFFFF'
}

function buildOneImage(text, fontSize) {
	let options = {
		font: `${fontSize}px google-sans-regular`,
		...defaultOptions
	}
	let data = text2png(text, options)
	return data
}

function buildImage(date, locationDescriptor) {
	let top = date == null ? null : buildOneImage(date, dataTextSize)
	let bottom = locationDescriptor == null ? null : buildOneImage(locationDescriptor, locationTextSize)
	return {
		top,
		bottom
	}
}

export {buildImage}

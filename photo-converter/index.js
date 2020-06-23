//TODO maybe piexifjs would allow us to read/copy over the exif tags?

const sharp = require('sharp')
const textOverlay = require('../text-overlay')

const width = 1920
const height = 1080

const margin = 16
const gap = 13

async function blend(inputFile) {
	let inputPipeline = sharp(inputFile, { failOnError: false }).rotate()
	let metadata = await inputPipeline.clone().metadata()
	let portrait = (metadata.height / metadata.width) > (height / width)//if landscape but the letterboxes will still be left and right then treat as portrait
	let backgroundPipeline = inputPipeline
	.clone()
	.blur(40)
	.resize({
		width: width,
		height: height,
		fit: sharp.fit.cover,
		position: sharp.strategy.attention
	}).modulate({
		brightness: 0.8
	})
	let foregroundResizeOptions = {
		fit: sharp.fit.inside
	}
	if (portrait) {
		foregroundResizeOptions.height = height
	} else {
		foregroundResizeOptions.width = width
	}
	let foregroundPipeline = inputPipeline
	.clone()
	.resize(foregroundResizeOptions)
	.toBuffer()

	let [background, foregroundBuffer] = await Promise.all([backgroundPipeline, foregroundPipeline])
	
	let overlays = await textOverlay.buildOverlays(inputFile)
	let topOverlay = overlays.top
	let bottomOverlay = overlays.bottom

    let topMetadata = await sharp(topOverlay).metadata()
    let bottomMetadata = await sharp(bottomOverlay).metadata()
    let topHeight = topMetadata.height
    let bottomHeight = bottomMetadata.height

	let outputPipeline = background.composite([
		//first put the resized image over the blured background	
		{
			input: foregroundBuffer,
			blend: 'over'
		},
		//then add the location information
		{
			input: bottomOverlay,
			blend: 'over',
			gravity: 'southwest',
			left: 16,
			top: height - (margin + bottomHeight)
		},
		//then add the date
		{
			input: topOverlay,
			blend: 'over',
			gravity: 'southwest',
			left: 16,
			top: height - (margin + bottomHeight + gap + topHeight)
		}
	])
	let outputFile = inputFile.replace(/(\/|\\|:)/g, '__')
	let info = await outputPipeline.toFile(`output/converted-photos/blended-${outputFile}`)
	console.log(info)
}

if (!module.parent) { //i.e. if being invoked directly on the command line
	async function main() {
		try {
			await blend('photo-converter/test-resources/input-04-landscape.jpg')
		} catch (err) {
			console.error(err)
		}
		await textOverlay.close()
	}
	main()
}

module.exports = {
    blend,
    close: textOverlay.close
}

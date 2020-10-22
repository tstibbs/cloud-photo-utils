//TODO maybe piexifjs would allow us to read/copy over the exif tags?

const sharp = require('sharp')
const textOverlay = require('../text-overlay')

const width = 1920
const height = 1080

const margin = 55
const gap = 15

async function blend(inputPath, outputPath) {
	let inputBuffer = await sharp(inputPath, { failOnError: false }).rotate().withMetadata().toBuffer();
	let metadata = await sharp(inputBuffer).metadata()
	let portrait = (metadata.height / metadata.width) > (height / width)//if landscape but the letterboxes will still be left and right then treat as portrait
	let backgroundPipeline = sharp(inputBuffer)
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
	let foregroundPipeline = sharp(inputBuffer).resize(foregroundResizeOptions).toBuffer()

	let [background, foregroundBuffer] = await Promise.all([backgroundPipeline, foregroundPipeline])
	
	let overlays = await textOverlay.buildOverlays(inputPath)
	let topOverlay = overlays.top
	let bottomOverlay = overlays.bottom
	let bottomHeight = null
	
	let compositions = [
		//first put the resized image over the blured background	
		{
			input: foregroundBuffer,
			blend: 'over'
		}
	]
	//then add the location information
	if (bottomOverlay != null) {
		let bottomMetadata = await sharp(bottomOverlay).metadata()
		bottomHeight = bottomMetadata.height
		compositions.push({
			input: bottomOverlay,
			blend: 'over',
			gravity: 'southwest',
			left: margin,
			top: height - (margin + bottomHeight)
		})
	}
	//then add the date
	if (topOverlay != null) {
		let topMetadata = await sharp(topOverlay).metadata()
		let topHeight = topMetadata.height
		let topMargin = margin + topHeight
		if (bottomHeight != null) {
			topMargin = topMargin + gap + bottomHeight
		}
		compositions.push({
			input: topOverlay,
			blend: 'over',
			gravity: 'southwest',
			left: margin,
			top: height - topMargin
		})
	}

	let outputPipeline = background.composite(compositions)
	let info = await outputPipeline.toFile(outputPath)
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
	close: textOverlay.close,
	init: textOverlay.init
}

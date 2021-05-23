import esMain from 'es-main'
import sharp from 'sharp'

import {buildOverlays, close, init} from '../text-overlay/index.js'
import {writeExifData} from '../text-overlay/exif.js'

const width = 1920
const height = 1080

const margin = 55
const gap = 15

async function blend(inputPath, outputPath, referencePath) {
	let inputBuffer = await sharp(inputPath, {failOnError: false}).rotate().withMetadata().toBuffer()
	let metadata = await sharp(inputBuffer).metadata()
	let portrait = metadata.height / metadata.width > height / width //if landscape but the letterboxes will still be left and right then treat as portrait
	let backgroundPipeline = sharp(inputBuffer)
		.blur(40)
		.resize({
			width: width,
			height: height,
			fit: sharp.fit.cover,
			position: sharp.strategy.attention
		})
		.modulate({
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

	let overlays = await buildOverlays(inputPath, referencePath)
	let topOverlay = overlays.top
	let bottomOverlay = overlays.bottom
	let exifData = overlays.exifData
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
	//write the exif back to the converted file for reference
	await writeExifData(outputPath, exifData)
}

if (esMain(import.meta)) {
	//i.e. if being invoked directly on the command line
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

export {blend, close, init}

//TODO maybe piexifjs would allow us to read/copy over the exif tags?

const sharp = require('sharp')

const width = 1920
const height = 1080

async function blend(inputFile) {
	let inputPipeline = await sharp(inputFile, { failOnError: false }).rotate()
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
	let outputPipeline = await background.composite([{
		input: foregroundBuffer,
		blend: 'over'
	}])
	let outputFile = inputFile.replace(/(\/|\\|:)/g, '__')
	let info = await outputPipeline.toFile(`output/converted-photos/blended-${outputFile}`)
	console.log(info)
}

if (!module.parent) { //i.e. if being invoked directly on the command line
	async function main() {
		try {
			await blend('input-04-landscape.jpg')
		} catch (err) {
			console.error(err)
		}
	}
	main()
}

module.exports = blend

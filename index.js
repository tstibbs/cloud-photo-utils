require('dotenv').config()
const diskPath = process.env.disk_path

//=====================================================

const fs = require('fs')
const util = require('util')
const readdir = util.promisify(fs.readdir)

const {download} = require('./amazon-photos-downloader')
const converter = require('./photo-converter')
const {upload} = require('./google-photos-uploader')

async function run() {
    let paths = await download()
    let pathsOnDisk = paths.filter(path => !path.startsWith('/Pictures/'))
    let pathsInCloud = paths.filter(path => path.startsWith('/Pictures/'))//TODO download these
    pathsOnDisk.map(path => path.replace(/^\/Backup\//, diskPath))
    for (path of paths) {
        console.log(`Converting ${path}`)
        await converter(path)
    }

    let outputDir = 'output/converted-photos/'
    let convertedFiles = await readdir(outputDir)
    for (path of convertedFiles) {
        await upload(outputDir + path)
    }
}
run()

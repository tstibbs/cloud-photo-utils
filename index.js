require('dotenv').config()
const diskPath = process.env.disk_path

//=====================================================

const fs = require('fs')
const util = require('util')
const readdir = util.promisify(fs.readdir)

const {listPaths, download} = require('./amazon-photos-downloader')
const converter = require('./photo-converter')
const {upload} = require('./google-photos-uploader')

async function run() {
    let pathsToIds = await listPaths()
    let paths = [...new Set(Object.keys(pathsToIds))].sort()
    let pathsOnDisk = paths.filter(path => !path.startsWith('/Pictures/'))
    let pathsInCloud = paths.filter(path => path.startsWith('/Pictures/'))
    pathsOnDisk = pathsOnDisk.map(path => path.replace(/^\/Backup\//, diskPath))
    for (path of pathsOnDisk) {
        console.log(`Converting ${path}`)
        await converter.blend(path)
    }

    let idsToDownload = pathsInCloud.map(path => pathsToIds[path])
    await download(idsToDownload)
    pathsInCloud = idsToDownload.map(id => `tmp/${id}.jpg`)
    for (path of pathsInCloud) {
        console.log(`Converting ${path}`)
        await converter.blend(path)
    }

    let outputDir = 'output/converted-photos/'
    let convertedFiles = await readdir(outputDir)
    for (path of convertedFiles) {
        await upload(outputDir + path)
    }
}

async function main() {
    try {
        await run()
    } catch (e) {
        console.error(e)
    }
    await converter.close()
}

main()

require('dotenv').config()
const diskPath = process.env.disk_path
const useCache = process.env.use_cache == 'true'

//=====================================================

const {readFile, writeFile, readdir} = require('./utils')

const {listPaths, download} = require('./amazon-photos-downloader')
const converter = require('./photo-converter')
const {upload} = require('./google-photos-uploader')

async function buildPathsToIds() {
    const cachePath = 'tmp/listCache.json'
    if (useCache) {
        let raw = await readFile(cachePath)
        return JSON.parse(raw)
    } else {
        let pathsToIds = await listPaths()
        await writeFile(cachePath, JSON.stringify(pathsToIds, null, 2))
        return pathsToIds
    }
}

async function run() {
    let pathsToIds = await buildPathsToIds()
    let paths = [...new Set(Object.keys(pathsToIds))].sort()
    let pathsOnDisk = paths.filter(path => !path.startsWith('/Pictures/'))
    let pathsInCloud = paths.filter(path => path.startsWith('/Pictures/'))
    pathsOnDisk = pathsOnDisk.map(path => path.replace(/^\/Backup\//, diskPath))
    for (path of pathsOnDisk) {
        console.log(`Converting ${path}`)
        await converter.blend(path)
    }

    let idsToDownload = pathsInCloud.map(path => pathsToIds[path])
    if (!useCache) {
        await download(idsToDownload)
    }
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

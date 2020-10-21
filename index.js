require('dotenv').config()
const diskPath = process.env.disk_path
const useCache = process.env.use_cache == 'true'

//=====================================================

const nodePath = require('path')

const readDirRecursive = require('fs-readdir-recursive')

const {readFile, writeFile, readdir} = require('./utils')
const {listPaths, download} = require('./amazon-photos-downloader')
const converter = require('./photo-converter')
const {upload} = require('./google-photos-uploader')
const {printDebugOutput} = require('./debug-printer.js')
const {buildOverlays} = require('./text-overlay')

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

const debugOnly = process.env.debugOnly == 'false'

async function convert(path) {
    console.log(`Converting ${path}`)
    if (!debugOnly) {
        await converter.blend(path)
    } else {
        await buildOverlays(path)
    }
}

async function run() {
    let pathsToIds = await buildPathsToIds()
    let paths = [...new Set(Object.keys(pathsToIds))].sort()
    let pathsOnDisk = paths.filter(path => !path.startsWith('/Pictures/'))
    let pathsInCloud = paths.filter(path => path.startsWith('/Pictures/'))
    pathsOnDisk = pathsOnDisk.map(path => path.replace(/^\/Backup\//, diskPath))
    const otherInputDir = 'tmp/otherInput'
    let otherPaths = readDirRecursive(otherInputDir)
    otherPaths = otherPaths.map(otherPath => otherInputDir + '/' + otherPath).map(otherPath => nodePath.resolve(otherPath))

    let idsToDownload = pathsInCloud.map(path => pathsToIds[path])
    if (!useCache) {
        await download(idsToDownload)
    }
    pathsInCloud = idsToDownload.map(id => `tmp/${id}.jpg`).map(otherPath => nodePath.resolve(otherPath))

    let allPaths = [
        ...pathsOnDisk,
        ...pathsInCloud,
        ...otherPaths
    ]
    for (path of allPaths) {
        await convert(path)
    }

    let outputDir = 'output/converted-photos/'
    let convertedFiles = await readdir(outputDir)
    for (path of convertedFiles) {
        await upload(outputDir + path)
    }

    await printDebugOutput()
}

async function main() {
    try {
        await converter.init()
        await run()
    } catch (e) {
        console.error(e)
    }
    await converter.close()
}

main()

require('dotenv').config()
const diskPath = process.env.disk_path
const useCache = process.env.use_cache == 'true'
const debugOnly = process.env.debugOnly == 'false'

//=====================================================

const nodePath = require('path')

const readDirRecursive = require('fs-readdir-recursive')

const {readFile, writeFile} = require('./utils')
const {listPaths, download} = require('./amazon-photos-downloader')
const converter = require('./photo-converter')
const {upload} = require('./google-photos-uploader')
const {printDebugOutput} = require('./debug-printer.js')
const {buildOverlays} = require('./text-overlay')

let outputDir = 'output/converted-photos/'

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

async function convert(referencePath, inputPath, outputPath) {
    console.log(`Converting ${referencePath}`)
    if (!debugOnly) {
        await converter.blend(inputPath, outputPath)
    } else {
        await buildOverlays(inputPath)
    }
}

function transformObj(obj, transformer) {
    return Object.fromEntries(transformer(Object.entries(obj)))
}

async function run() {
    let pathsToIds = await buildPathsToIds() //map of the cloud path to the cloud object id
    let pathsOnDisk = transformObj(pathsToIds, entries => entries.filter(([path, id]) => !path.startsWith('/Pictures/')).map(([path, id]) => [path, path.replace(/^\/Backup\//, diskPath)]))
    let pathsInCloud = transformObj(pathsToIds, entries => entries.filter(([path, id]) => path.startsWith('/Pictures/')))
    const otherInputDir = 'tmp/otherInput'
    let otherPaths = readDirRecursive(otherInputDir)
    otherPaths = Object.fromEntries(otherPaths.map(otherPath => ['Unmanaged/' + otherPath, nodePath.resolve(otherInputDir + '/' + otherPath)]))

    if (!useCache) {
        await download(Object.values(pathsInCloud))
    }
    pathsInCloud = transformObj(pathsInCloud, entries => entries.map(([path, id]) => [path,  nodePath.resolve(`tmp/${id}.jpg`)]))

    let allPaths = {
        ...pathsOnDisk,
        ...pathsInCloud,
        ...otherPaths
    }
    allPaths = Object.entries(allPaths).map(([referencePath, physicalPath]) => [referencePath, {
        inputPath: physicalPath,
        outputPath: outputDir + 'blended-' + referencePath.replace(/(\/|\\|:)/g, '__')
    }])
    console.log(JSON.stringify(allPaths, null, 2))
    console.log(allPaths.length)
    for ([referencePath, {inputPath, outputPath}] of allPaths) {
        await convert(referencePath, inputPath, outputPath)
    }
    allPaths = allPaths.map(([referencePath, {outputPath}]) => [referencePath, outputPath])

    for ([referencePath, outputPath] of allPaths) {
        await upload(referencePath, outputPath)
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

const fs = require('fs')
const util = require('util')

const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const mkdir = util.promisify(fs.mkdir)
const access = util.promisify(fs.access)

async function fileExists(path) {
    try {
        await access(path)
        return true
    } catch (e) {
        if (e.code == 'ENOENT') {
            return false
        } else {
            throw e
        }
    }
}

module.exports = {
    readdir,
    readFile,
    writeFile,
    mkdir,
    fileExists
}

const fs = require('fs')
const util = require('util')

const readdir = util.promisify(fs.readdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)
const mkdir = util.promisify(fs.mkdir)

module.exports = {
    readdir,
    readFile,
    writeFile,
    mkdir
}

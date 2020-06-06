//may want to invoke with something like:
//for i in {01..06}; do node . "[parent]" "Disc$i"; done

const fs = require('fs')
const util = require('util')
const {BlobServiceClient} = require("@azure/storage-blob")
const writeFile = util.promisify(fs.writeFile)
const mkdir = util.promisify(fs.mkdir)

const outputFolder = 'output/azure-blob-lists'

let STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
let blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING)

const containerName = "photos-backup";

const containerClient = blobServiceClient.getContainerClient(containerName);

if (process.argv.length != 4) {
	console.error("Incorrect arguments given")
	process.exit(1)
}

let myArgs = process.argv.slice(2)
let parentFolder = myArgs[0] + '/'
let folderToList = myArgs[1]

let parentFolderLength = parentFolder.length
let filename = `${outputFolder}/${parentFolder}${folderToList}.md5.azure`

let options = {
	prefix: `${parentFolder}${folderToList}/`
}

async function main() {
	try {
		await mkdir(outputFolder)
	} catch (err) {
		//ignore, probably already exists
	}
	try {
		await mkdir(parentFolder)
	} catch (err) {
		//ignore, probably already exists
	}
	//force file to be (re)created as utf-8
	await writeFile(filename, '', 'utf8')
	let stream = fs.createWriteStream(filename, { flags: 'a' });
	let blobs = await containerClient.listBlobsFlat(options);
	for await (const blob of blobs) {
		let name = blob.name
		if (!name.endsWith('/Thumbs.db')) {
			let md5 = blob.properties.contentMD5.toString('hex')
			if (name.startsWith(parentFolder)) {
				name = name.substring(parentFolderLength)
			}
			let line = `${md5}  ${name}\n`
			stream.write(line);
		}
	}
	stream.end();
}

main();

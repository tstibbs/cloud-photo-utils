import 'dotenv/config'
import {lstat, readdir} from 'fs/promises'
import {resolve, relative} from 'path'
import {BlobServiceClient} from '@azure/storage-blob'

const archiveTier = 'Archive'

const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
const containerName = process.env.AZURE_CONTAINER_NAME

const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString)
const containerClient = blobServiceClient.getContainerClient(containerName)

let uploadedCount = 0
let errorCount = 0

let appArgs = process.argv.slice(2)
if (appArgs.length != 2) {
	console.error('Usage: node azure/blob-uploader.js path part_of_path_to_ignore_in_blob_name') //doesn't matter if the paths end in slashes or not
	process.exit(1)
}
const startingDirectory = appArgs[0]
const pathToIgnore = appArgs[1] //remove this part when creating the blob name
await checkIsDir(startingDirectory)
await checkIsDir(pathToIgnore)

for await (const filePath of getFiles(startingDirectory)) {
	if (!filePath.endsWith('/Thumbs.db')) {
		await uploadFile(filePath)
	}
}
console.log(`Uploaded: ${uploadedCount}`)
console.log(`Errored: ${errorCount}`)

async function checkIsDir(path) {
	const stat = await lstat(path)
	if (!stat.isDirectory()) {
		console.error(`${path} needs to be a directory that exists.`)
		process.exit(1)
	}
}

async function* getFiles(dir) {
	const dirEntries = await readdir(dir, {withFileTypes: true})
	for (const dirEntry of dirEntries) {
		const fullPath = resolve(dir, dirEntry.name)
		if (dirEntry.isDirectory()) {
			//continue traversing down
			yield* getFiles(fullPath)
		} else {
			//we've found a file, so return that
			yield fullPath
		}
	}
}

async function uploadFile(filePath) {
	const blobName = relative(pathToIgnore, filePath)
	console.log(`Uploading ${filePath} to ${blobName}`)
	const blockBlobClient = containerClient.getBlockBlobClient(blobName)
	const uploadBlobResponse = await blockBlobClient.uploadFile(filePath, {
		tier: archiveTier
	})
	if (uploadBlobResponse.errorCode === undefined) {
		uploadedCount++
	} else {
		console.error(`Error uploading ${filePath} to ${blobName}`)
		console.error(uploadBlobResponse)
		errorCount++
		process.exitCode = 1
	}
}

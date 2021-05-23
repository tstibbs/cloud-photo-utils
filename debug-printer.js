import fs from 'fs'

const fileDetails = []

function storeGeoDetails(filename, details) {
	fileDetails.push({
		filename,
		...details
	})
}

async function printGeo(fileStream, details) {
	const {address, lat, lng, url, chosenFields, filename} = details
	//this code works when using WSL 1 reading from a mounted windows drive - ymmv elsewhere
	let windowsPath = filename.replace(/\/mnt\/(\w)\//, '$1:/')
	write(fileStream, `<p><img src="file:///${windowsPath.replace(/ /g, '%20')}" height="60">${windowsPath}</p>`)
	if (address != null) {
		let keys = Object.keys(address)
		let values = Object.values(address)
		write(fileStream, `<!-- "${lat},${lng}": "${chosenFields.join(', ')}", -->`)
		let chosenFieldPositions = chosenFields.filter(field => field != undefined).map(field => values.indexOf(field))
		write(fileStream, `<a href="${url}">${url}</a>`)
		write(fileStream, '<table style="border: 1px solid black; border-collapse: collapse;">')
		let all = [keys, values]
		all.forEach(group => {
			write(fileStream, '<tr style="border: 1px solid black;">')
			group.forEach((key, i) => {
				let style = 'border: 1px solid black;'
				if (chosenFieldPositions.includes(i)) {
					style += ' background-color: lightgrey;'
				}
				write(fileStream, `<td style="${style}">${key}</td>`)
			})
			write(fileStream, '</tr>')
		})
		write(fileStream, '</table>')
	}
	write(fileStream, '<hr>')
}

async function write(fileStream, line) {
	fileStream.write(line)
	fileStream.write('\n')
}

async function printDebugOutput() {
	const fileStream = fs.createWriteStream('output/debug.html')
	write(fileStream, '<html><body>')
	for (let details of fileDetails) {
		await printGeo(fileStream, details)
	}
	write(fileStream, '</body></html>')
	fileStream.end()
}

export {storeGeoDetails, printDebugOutput}

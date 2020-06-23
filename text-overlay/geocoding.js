const axios = require('axios');

function parseField(...fields) {
    fields = fields.filter(item => item != undefined)
    let field = fields.length >= 0 ? fields[0] : null // 
    return field
}

async function buildDescriptor(lat, lng) {
    let response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
    let data = response.data;
    let address = data.address
    let titleField = parseField(address.tourism, address.historic, address.railway, address.shop, address.building)
    let locality = parseField(address.village, address.town, address.suburb)
    let area = parseField(address.city, address.county)
    let country = address.country != 'United Kingdom' ? address.country : null
    if (locality == null || area == null) {
        console.error("Didn't find all the fields we expected:")
        console.error(`locality: ${locality}`)
        console.error(`area: ${area}`)
        console.error(data)
    }
    let descriptor = [titleField, locality, area, country].filter(item => item != null).join(', ')
    return descriptor
}

module.exports = {
    buildDescriptor
}

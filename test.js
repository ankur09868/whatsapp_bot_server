import axios from "axios"

const response = await axios.post('http://localhost:8001/contacts/', {phone: 9548}, {headers: {"X-Tenant-Id": "ai"}})

console.log(response.data)
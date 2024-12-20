import { getImageAndUploadToBlob } from "./handle-media.js"; 

const mediaId = '1120339625617178'
const access_token = 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P'

const url = await getImageAndUploadToBlob(mediaId, access_token)
console.log(url)
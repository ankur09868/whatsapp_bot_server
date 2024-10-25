import express from 'express';
import multer from 'multer';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFile } from 'fs/promises';

async function mediaUploads(mediaID, access_token, user_data) {
    let headers = { Authorization: `Bearer ${access_token}` };
    
    try {
        // Fetch media metadata
        let response = await axios.get(`https://graph.facebook.com/v19.0/${mediaID}`, { headers });
        const mediaURL = response.data.url;
        const mime_type = response.data.mime_type
        console.log(mediaURL);

        // Fetch the media file
        response = await axios.get(mediaURL, { headers, responseType: 'arraybuffer' });
        
        if(mime_type == "application/pdf"){
            console.log("processing pdfs")
        // Create a Blob from the ArrayBuffer
        const media = new Blob([response.data], { type: 'application/pdf' });

        // Create FormData and append the Blob
        const formData = new FormData();
        formData.append('pdf', media, 'file.pdf'); // Provide a default filename

        // Send the FormData with the file to the Python server
        let postResponse = await axios.post(`/whatsapp-media-uploads/`, formData, {
            headers: {'X-Tenant-Id': 'three_little_birds', 'user-data': JSON.stringify(user_data)}
        });

        console.log(postResponse.data);
        }
        else if (["image/jpeg", "image/webp"].includes(mime_type)){
            console.log("processing image")
            const media = response.data;

            const base64Media = Buffer.from(media).toString('base64');
            const data = {
                image_buffer: base64Media
            }
            let postResponse = await axios.post('http://localhost:8000/whatsapp-media-uploads/', data ,{
                headers: {'X-Tenant-Id': 'three_little_birds', 'user-data': JSON.stringify(user_data)}
            })

            console.log(postResponse.data)
        }

    } catch (error) {
        console.error(error);
    }
}

const mediaID = 909478364398748;
const access_token = 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P';  // Replace with your actual access token
const data = {
    name: "name",
    phone: 919548265904,
    doc_name: "doc_name"
  }
await mediaUploads(mediaID, access_token, data);

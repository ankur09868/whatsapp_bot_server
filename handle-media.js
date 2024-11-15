import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendProductMessage, sendListMessage, sendInputMessage, sendButtonMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, fastURL, djangoURL } from "./snm.js";
import { userSessions, io } from "./server.js";
import axios from "axios";
import { BlobServiceClient } from '@azure/storage-blob';

import FormData from 'form-data';

export async function getImageAndUploadToBlob(imageID, access_token) {
    try {
      const account = "pdffornurenai";
      const sas = "sv=2022-11-02&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2025-06-01T16:13:31Z&st=2024-06-01T08:13:31Z&spr=https&sig=8s7IAdQ3%2B7zneCVJcKw8o98wjXa12VnKNdylgv02Udk%3D";
      const containerName = 'pdf';
  
      const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net/?${sas}`);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      
      // const fileExtension = contentType.split('/').pop();
      const newFileName = `image_${imageID}`;
  
      const blockBlobClient = containerClient.getBlockBlobClient(newFileName);
      const exists = await checkBlobExists(blockBlobClient);
      if (exists == false){
        console.log("blob doesnt exist")
        const url = `https://graph.facebook.com/v16.0/${imageID}`;
        const response = await axios.get(url, {
          headers: { "Authorization": `Bearer ${access_token}` }
        });
  
        const imageURL = response.data?.url;
        if (!imageURL) {
          throw new Error('Image URL not found');
        }
  
        console.log("Image URL: ", imageURL);
  
        const imageResponse = await axios.get(imageURL, {
          headers: { "Authorization": `Bearer ${access_token}` },
          responseType: 'arraybuffer'
        });
  
        const imageBuffer = imageResponse.data;
        const contentType = imageResponse.headers['content-type'];
  
        const uploadBlobResponse = await blockBlobClient.uploadData(imageBuffer, {
          blobHTTPHeaders: {
            blobContentType: contentType,
          },
        });
  
        console.log(`Uploaded image ${newFileName} successfully, request ID: ${uploadBlobResponse.requestId}`);
      }
      return blockBlobClient.url;
  
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
}

export async function checkBlobExists(blockBlobClient){
    try{
      const response = await blockBlobClient.getProperties();
      return response !== null;
    } catch (error){
      if (error.statusCode === 404){
        return false;
      }
      throw error;
    }
}

export async function handleMediaUploads(name, phone, doc_name, mediaID, userSession, tenant) {
const access_token = userSession.accessToken;
const openai_key = process.env.OPENAI_API_KEY;
console.log(access_token)

let headers = { Authorization: `Bearer ${access_token}`, };
try {
    let response = await axios.get(`https://graph.facebook.com/v19.0/${mediaID}`, { headers });
    const mediaURL = response.data.url;
    console.log(mediaURL);

    response = await axios.get(mediaURL, { headers, responseType: 'arraybuffer' });
    const media = response.data;

    const base64Media = Buffer.from(media).toString('base64');

    const payload = {
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: travel_ticket_prompt,
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Media}`,
                        },
                    },
                ],
            },
        ],
    };

    const openAIHeaders = {
        Authorization: `Bearer ${openai_key}`,
        'Content-Type': 'application/json',
    };

    response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers: openAIHeaders });

    let result = response.data.choices[0].message.content

    const startIndex =  result.indexOf('{')
    const endIndex = result.lastIndexOf('}') + 1;

    const resultJSON = JSON.parse(result.substring(startIndex, endIndex).trim())
    
    const data = {
        name: name,
        phone: phone,
        doc_name: doc_name || "default",
        data: resultJSON,
        tenant: tenant
    }
    console.log(data)
    response = await axios.post(`${djangoURL}/user-data/`, data, {headers: {'X-Tenant-Id': tenant}})
    console.log(response.data)
    
    // const query = `Which hotel should I stay in ${resultJSON.destination}?`
    
} catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
}
}

import FormData from 'form-data';

export async function getMediaID(handle, bpid, access_token) {
  try {
    console.log("HANDLE: ", handle, bpid, access_token);

    // Fetch the image as an arraybuffer
    const imageResponse = await axios.get(handle, { responseType: 'arraybuffer' });
    console.log("Image response received.");

    // Create FormData instance
    const formData = new FormData();
    
    // Append the image buffer with filename and MIME type
    formData.append('file', Buffer.from(imageResponse.data), {
      filename: 'image.jpeg',      // specify a name for the file
      contentType: 'image/jpeg',   // specify the MIME type
    });
    formData.append('type', 'image/jpeg');
    formData.append('messaging_product', 'whatsapp');

    // Send the request to Facebook Graph API to upload media
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${bpid}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          ...formData.getHeaders(), // Important: includes the correct Content-Type for multipart/form-data
        }
      }
    );

    console.log("Media ID Response: ", response.data);
    return response.data.id;

  } catch (error) {
    console.error("Error in getMediaID:", error.response ? error.response.data : error.message);
    throw error;
  }
}




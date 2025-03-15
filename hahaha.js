

// With this ES Module syntax:
import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function uploadMedia(filePath, type, bpid, accessToken) {
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', type); // image, audio, document, video, or sticker
    form.append('messaging_product', 'whatsapp');

    // Upload the file
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${bpid}/media`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('Media uploaded successfully:', response.data);
    return response.data.id; // This is your media ID
  } catch (error) {
    console.error('Error uploading media:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
const mediaId = await uploadMedia(
  'C:\\Users\\Adarsh\\Desktop\\WhatsApp Image 2025-02-04 at 12.11.46_94c32b3d.jpg',
  'image',
  '534896646366826',
  'EAAVZBobCt7AcBO1IxLG4luufAySUGczTQZAeGZBZBDsGRLQZAaLJSVVCfTDJ1Eq23V7WhS6PVYZBCr9AHatrUyyFLuUDMXMLm2q2Oed2F9LAfsozZAVDvUvmBJNgGH8YVjpbOFTHVJjvZAQ2RY6aliQqpAP3XvrhxLm2tFJx8eobUxpX8njE1V2BmWhxwMmqfwfdjTqWJlFfdzR7qqkAZCv6HmQqYZASW1xkplAePvGYdJinL0Ibh5FvSFYfxkUyqR'
);
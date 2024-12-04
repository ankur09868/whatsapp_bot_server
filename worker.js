import { messageQueue } from "./queues/messageQueue.js";
import axios from "axios";
import NodeCache from 'node-cache';


import FormData from 'form-data';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// const djangoURL = 'http://localhost:8001'
const djangoURL = "https://backeng4whatsapp-dxbmgpakhzf9bped.centralindia-01.azurewebsites.net"


export const messageCache = new NodeCache({ stdTTL: 600 });


messageQueue.process("send-template", async (job) => {
    const {
      phoneNumbers,
      templateData,
      business_phone_number_id,
      tenant_id,
      bg_id,
      bg_name,
      access_token,
      account_id,
      otp,
    } = job.data;
  
    console.log(`Processing job for tenant: ${tenant_id}`);
  
    try {
      const batchSize = 80;
      const results = [];
  
      for (let i = 0; i < phoneNumbers.length; i += batchSize) {
        const batch = phoneNumbers.slice(i, i + batchSize);
  
        const batchResults = await Promise.allSettled(
          batch.map(async (phoneNumber) => {
            try {
              // Generate message data
              const messageData = await setTemplate(
                templateData,
                phoneNumber,
                business_phone_number_id,
                access_token,
                otp
              );
  
              console.log("Message Data: ", messageData);
  
              // Send message template
              const sendMessageResponse = await sendMessageTemplate(
                phoneNumber,
                business_phone_number_id,
                messageData,
                access_token,
                null,
                tenant_id
              );
  
              const messageID = sendMessageResponse.data?.messages[0]?.id;
  
              if (messageID) {
                const broadcastGroup = {
                  id: bg_id || null,
                  name: bg_name || null,
                  template_name: templateData?.name || null,
                };
  
                // Update status
                updateStatus(
                  "sent",
                  messageID,
                  business_phone_number_id,
                  phoneNumber,
                  broadcastGroup,
                  tenant_id,
                  Date.now()
                );
              }
  
              return { phoneNumber, status: "success", messageID };
            } catch (error) {
              console.error(`Failed to send message to ${phoneNumber}: ${error.message}`);
              return { phoneNumber, status: "failed", error: error.message };
            }
          })
        );
  
        results.push(...batchResults);
  
        // Wait before processing the next batch to respect API rate limits
        if (i + batchSize < phoneNumbers.length) {
          console.log(`Waiting for 1 second before sending the next batch...`);
          await delay(1000);
        }
      }
  
      console.log("Job completed:", JSON.stringify(results, null, 2));
    } catch (error) {
      console.error("Error processing job:", error.message);
    }
  });
  


export async function setTemplate(templateData, phone, bpid, access_token, otp) {

try {
    console.log("otp rcvd: ", otp)
    const components = templateData?.components;
    const template_name = templateData.name;
    const cacheKey = `${template_name}_${phone}_${bpid}_${otp}`
    let messageData = messageCache.get(cacheKey)
    if(!messageData){
    const res_components = [];

    for (const component of components) {
    if (component.type === "HEADER") {
        const header_handle = component?.example?.header_handle || [];
        const header_text = component?.example?.header_text || [];
        const parameters = [];

        for (const handle of header_handle) {
        const mediaID = await getMediaID(handle, bpid, access_token)
        parameters.push({
            type: "image",
            image: { id: mediaID }
        });
        }
        for (const text of header_text) {
        let modified_text = await replacePlaceholders(text, null, phone, bpid)
        parameters.push({
            type: "text",
            text: modified_text
        });
        }
        if(parameters.length> 0){
        const header_component = {
        type: "header",
        parameters: parameters
        };
        res_components.push(header_component);
    }
    }
    else if (component.type === "BODY") {
        const body_text = component?.example?.body_text[0] || [];
        const parameters = [];
        
        for (const text of body_text) {
        let modified_text
        if(otp) modified_text = otp
        else modified_text = await replacePlaceholders(text, null, phone, bpid)

        parameters.push({
            type: "text",
            text: modified_text
        });
        }
        if(parameters.length > 0){
        const body_component = {
        type: "body",
        parameters: parameters
        };
        res_components.push(body_component);
    }
    } else {
        console.warn(`Unknown component type: ${component.type}`);
    }
    }

    messageData = {
    type: "template",
    template: {
        name: template_name,
        language: {
        code: "en_US"
        },
        components: res_components
    }
    }
    messageCache.set(cacheKey, messageData)
    };

    return messageData;
} catch (error) {
    console.error("Error in setTemplate function:", error);
    throw error; // Rethrow the error to handle it further up the call stack if needed
}
}

export async function sendMessageTemplate(phoneNumber, business_phone_number_id, messageData, access_token = null, fr_flag, tenant) {
    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;

    try {
        const response = await axios.post(
            url, 
            {
                messaging_product: "whatsapp", 
                recipient_type: "individual",
                to: phoneNumber,
                ...messageData
            },
            {
                headers: { Authorization: `Bearer ${access_token}` }
            }
        );


        const mediaID = messageData?.video?.id || messageData?.audio?.id || messageData?.image?.id
        if (mediaID != undefined){
            mediaURLPromise = await getImageAndUploadToBlob(mediaID, access_token).then(mediaURL => {
                if (messageData?.video?.id) {
                    messageData.video.id = mediaURL;
                } else if (messageData?.audio?.id) {
                    messageData.audio.id = mediaURL;
                } else if (messageData?.image?.id) {
                    messageData.image.id = mediaURL;
                    
                }
                console.log("message data  updated: ", messageData)
            })
        }


        // if(messageData?.interactive?.type == 'product')
        
        const now = Date.now()
        const timestamp = now.toLocaleString();

            try{
                console.log("MESSAGE DATA: ", JSON.stringify(messageData, null, 4))
                let formattedConversation = [{ text: messageData, sender: "bot" }];

                try {
                    console.log("Saving convo data: ", phoneNumber, business_phone_number_id, formattedConversation ,tenant)
                    const saveRes = axios.post(
                        `${djangoURL}/whatsapp_convo_post/${phoneNumber}/?source=whatsapp`, 
                        {
                          contact_id: phoneNumber,
                          business_phone_number_id: business_phone_number_id,
                          conversations: formattedConversation,
                          tenant: tenant || userSession?.tenant,
                        }, 
                        {
                          headers: {
                            'Content-Type': 'application/json',
                            'X-Tenant-Id': tenant || userSession?.tenant,
                          },
                        }
                      );
                      

            // if (!saveRes.ok) throw new Error("Failed to save conversation");
            // console.log("Conversation saved successfully");

        } catch (error) {
            console.error("Error saving conversation:", error.message);
        }
            }catch(error){
                console.log("error occured while emission: ", error)
            }
        

        // Optionally log or process the response
        console.log('Message sent successfully:', response.data);

        return { success: true, data: response.data };

    } catch (error) {
        // Log the error details
        if (error.response) {
            // The request was made, and the server responded with a status code outside 2xx
            console.error('Response Error:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No Response Error:', error.request);
        } else {
            // Some other error occurred in setting up the request
            console.error('Setup Error:', error.message);
        }

        // Return the error details to the caller
        return { 
            success: false, 
            error: error.response ? error.response.data : error.message 
        };
    }
}


export async function getMediaID(handle, bpid, access_token) {
try {
    console.log("HANDLE: ", handle, bpid, access_token);
    const cacheKey = `${handle}_${bpid}_${access_token}`
    let mediaID = messageCache.get(cacheKey)

    if(!mediaID){
    // Fetch the image as an arraybuffer
    const imageResponse = await axios.get(handle, { responseType: 'arraybuffer' });
    console.log("Image response received.", imageResponse.data);
    

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

    mediaID = response.data.id;
    messageCache.set(cacheKey, response.data.id)
}

return mediaID


} catch (error) {
    console.error("Error in getMediaID:", error.response ? error.response.data : error.message);
    throw error;
}
}


export async function  updateStatus(status, message_id, business_phone_number_id, user_phone, broadcastGroup, tenant, timestamp) {
    let isRead = false;
    let isDelivered = false;
    let isSent = false;
    let isReplied = false;
    let isFailed = false;
    
    try {
        if (status === "replied"){
        isReplied = true;
        isRead = true;
        isDelivered = true;
        isSent = true;
        } else if (status === "read") {
        isRead = true;
        isDelivered = true;
        isSent = true;
        } else if (status === "delivered") {
        isDelivered = true;
        isSent = true;
        } else if (status === "sent") {
        isSent = true;
        } else if (status === "failed"){
        isRead = false;
        isDelivered = false;
        isSent = false;
        isReplied = false;
        isFailed = true;
        }
    
        // Prepare data to send
        const data = {
            business_phone_number_id: business_phone_number_id,
            is_failed: isFailed,
            is_replied: isReplied,
            is_read: isRead,
            is_delivered: isDelivered,
            is_sent: isSent,
            user_phone: user_phone,
            message_id: message_id,
            bg_id : broadcastGroup?.id,
            bg_name : broadcastGroup?.name,
            template_name : broadcastGroup?.template_name,
            timestamp: timestamp
        };
        // console.log("Tenant Sent: ", tenant)
        // console.log("Sending request with data:", data);
    
        // Send POST request with JSON payload
        const response = await axios.post(`${djangoURL}/set-status/`, data, {
        headers: { 
            "X-Tenant-Id": tenant, 
            "Content-Type": "application/json" 
        }
        });
    
        console.log("Response received:", response.data);
    } catch (error) {
        console.error("Error updating status:", error.response ? error.response.data : error.message);
    }
    }


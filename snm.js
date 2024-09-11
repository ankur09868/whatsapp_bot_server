
import { userSessions, io, updateStatus } from "./server.js";
import axios from "axios";
import { BlobServiceClient } from '@azure/storage-blob';
export const baseURL = 'https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/'



export async function sendMessage(phoneNumber, business_phone_number_id, messageData, access_token = null) {
    const key = phoneNumber + business_phone_number_id;
    const userSession = userSessions.get(key);

    if (!userSession && access_token == null) {
        console.error("User session not found and no access token provided.");
        return { success: false, error: "User session or access token missing." };
    }

    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
    console.log('Sending message to:', phoneNumber);
    console.log('Message Data:', messageData);

    // Use session access token if not provided
    if (access_token == null) access_token = userSession.accessToken;

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

        // Check if the message was sent successfully
        if (response.data && response.data.messages && response.data.messages.length > 0) {
            console.log('Message sent successfully:', response.data);
            const messageID = response.data.messages[0].id;
            const status = "sent";

            // Update status
            updateStatus(status, messageID, business_phone_number_id, phoneNumber);

            const mediaID = messageData?.video?.id || messageData?.audio?.id || messageData?.image?.id
            if (mediaID != undefined){
                const mediaURL = await getImageAndUploadToBlob(mediaID, access_token)

                if (messageData?.video?.id) {
                    messageData.video.id = mediaURL;
                } else if (messageData?.audio?.id) {
                    messageData.audio.id = mediaURL;
                } else if (messageData?.image?.id) {
                    messageData.image.id = mediaURL;
                }
                console.log("message data  updated: ", messageData)
            }
            // Prepare conversation data
            let formattedConversation = [{ text: messageData, sender: "bot" }];

            // Save conversation
            try {
                const saveRes = fetch(`${baseURL}/whatsapp_convo_post/${phoneNumber}/?source=whatsapp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Tenant-Id': 'll',
                    },
                    body: JSON.stringify({
                        contact_id: phoneNumber,
                        conversations: formattedConversation,
                        tenant: 'll',
                    }),
                });

                if (!saveRes.ok) throw new Error("Failed to save conversation");
                console.log("Conversation saved successfully");

            } catch (error) {
                console.error("Error saving conversation:", error.message);
            }
            return { success: true, data: response.data };

        } else {
            throw new Error("Message not sent");
        }

    } catch (error) {
        console.error('Failed to send message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

export async function sendLocationMessage(phone, bpid, body, access_token) {
    const { latitude, longitude, name, address } = body
    const messageData = {
        type: "location",
        location : {
            latitude: latitude,
            longitude: longitude,
            name: name,
            address: address
        }
    }
    return sendMessage(phone, bpid, messageData, access_token)
}

export async function sendVideoMessage(phone, bpid, videoID, access_token) {
    const messageData = {
        type : "video",
        video : {
            id: videoID
        }
    }
    return sendMessage(phone, bpid, messageData, access_token)
}

export async function sendAudioMessage(phone, bpid, audioID, access_token) {
  const messageData = {
    type: "audio",
    audio: { id: audioID}
  }
  return sendMessage(phone, bpid, messageData, access_token)
}
  
export async function sendTextMessage(userPhoneNumber, business_phone_number_id,message, access_token = null){
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token)
} 
 
export async function sendImageMessage(phoneNumber, business_phone_number_id, imageID, caption, access_token = null) {
    const messageData = {
        type: "image",
        image: {
            id: imageID,
            caption: caption
        }
    };
    console.log("IMAGEEEE");
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token);
}
  
export async function sendButtonMessage(buttons, message, phoneNumber, business_phone_number_id, access_token = null) {
    const key = phoneNumber + business_phone_number_id
    console.log("USER SESSIONS: ", userSessions, key)
    const userSession = userSessions.get(key);
    console.log("USER SESSION: ", userSession)
    const flow = userSession.flowData
    try {
        let button_rows = buttons.map(buttonNode => ({
            type: 'reply',
            reply: {
                id: flow[buttonNode].id,
                title: flow[buttonNode].body
            }
        }));
        console.log("button_row:" ,button_rows)
        const messageData = {
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: message },
                action: { buttons: button_rows }
            }
        }
        return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token)
    } catch (error) {
        console.error('Failed to send button message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

export async function sendInputMessage(userPhoneNumber, business_phone_number_id,message, access_token = null){
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token)
}

export async function sendListMessage(list, message, phoneNumber, business_phone_number_id, access_token =  null) {
    const key = phoneNumber + business_phone_number_id
    console.log("USER SESSIONS: ",  userSessions, key)
    const userSession = userSessions.get(key);
    const flow = userSession.flowData
  
    const rows = list.map((listNode, index) => ({
        id: flow[listNode].id,
        title: flow[listNode].body
    }));
    const messageData = {
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: message },
            action: {
                button: "Choose Option",
                sections: [{ title: "Section Title", rows }]
            }
        }
    };
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token);
}

export async function sendNodeMessage(userPhoneNumber, business_phone_number_id) {
    const key = userPhoneNumber + business_phone_number_id
    const userSession = userSessions.get(key);
    if (!userSession) {
        console.error(`No session found for user ${userPhoneNumber}`);
        return;
    }
    // console.log("session for node message: ", userSession)
    const { flowData, adjList, currNode, accessToken } = userSession;
    const flow = flowData;
    const adjListParsed =adjList;
    console.log(currNode)
    if (typeof currNode !== 'undefined' && currNode !== null && adjListParsed) {
        const nextNode = adjListParsed[currNode];
        var node_message = flow[currNode]?.body;
        if (node_message) {
            io.emit('node-message', {
                message: node_message,
                phone_number_id: business_phone_number_id
            });
        console.log("Emitted node message:", node_message);
        }
        
        let sendMessagePromise;
        let sendDynamicPromise;
        switch (flow[currNode]?.type) {
            case "Button":
                const buttons = nextNode

                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable

                    // userSession.inputVariableType = flow[currNode]?.InputType[0]
                    console.log("input variable: ", userSession.inputVariable)
                    var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    var modelName = userSession.flowName
                    sendDynamicPromise = addDynamicModelInstance(modelName, data)
                }
        
                sendMessagePromise = sendButtonMessage(buttons, node_message, userPhoneNumber,business_phone_number_id);
                break;
                
            case "List":
                const list = nextNode

                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                
                    console.log("input variable: ", userSession.inputVariable)
                    var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    var modelName = userSession.flowName
                    sendDynamicPromise = addDynamicModelInstance(modelName, data)
                }
                
                sendMessagePromise = sendListMessage(list, node_message, userPhoneNumber,business_phone_number_id, accessToken);
                break;
            case "Text":

                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                 
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                    
                    console.log("input variable: ", userSession.inputVariable)
                    var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    var modelName = userSession.flowName
                    sendDynamicPromise = addDynamicModelInstance(modelName, data)
                }

                sendMessagePromise = sendInputMessage(userPhoneNumber,business_phone_number_id, node_message);
                break;
              
            case "string":
                
                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                 
                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);
                userSession.currNode = nextNode[0] || null;
                console.log("string currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            case "image":
                const caption = flow[currNode]?.body?.caption
                var placeholders = [...caption.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) caption = await replacePlaceholders(node_message, userSession)
                 
                await sendImageMessage(userPhoneNumber,business_phone_number_id, flow[currNode]?.body?.id, flow[currNode]?.body?.caption ,accessToken);
                userSession.currNode = nextNode[0] || null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "audio":

                sendMessagePromise  = sendAudioMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body?.audioID, accessToken);
                userSession.currNode = nextNode[0] || null;
                console.log("audio currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "video":
                sendMessagePromise = sendVideoMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body?.videoID, accessToken);
                userSession.currNode = nextNode[0] || null;
                console.log("video currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "location":

                sendMessagePromise = sendLocationMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body , accessToken)
                userSession.currNode = nextNode[0] || null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "AI":
                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);
                userSession.AIMode = true;
                break;
                
            default:
                console.log(`Unknown node type: ${flow[currNode]?.type}`);
        }
        userSession.nextNode = nextNode;
        userSessions.set(userPhoneNumber+business_phone_number_id, userSession);
        await Promise.all([sendMessagePromise, sendDynamicPromise])
    }
    else{
        userSession.currNode = 0;
        userSession.nextNode = adjListParsed[userSession.currNode] || [];
    }
    
}

export async function addDynamicModelInstance(modelName, updateData) {
    const url = `${baseURL}/dynamic-model-data/${modelName}/`;
    const data = updateData;
    console.log("DATAAAAAAAAAAAAAAAAAAAAAAA: ", data)
    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': 'll'
            },
        });
        console.log('Data updated successfully:', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`Failed to add dynamic model instance: ${error.response.status}, ${error.response.data}`);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error in setting up the request:', error.message);
        }
        console.error('Config details:', error.config);
        return null;
    }
}


export async function replacePlaceholders(message, userPhoneNumber = null) {
    
    let modifiedMessage = message;

    const placeholders = [...message.matchAll(/{{\s*[\w]+\s*}}/g)];
    
    for (const placeholder of placeholders) {
        let key = placeholder[0].slice(2, -2).trim();
        // const keys = key.split('.')
        var url = `${baseURL}/contacts-by-phone/${userPhoneNumber}`;

        // if(keys[0]=="contact") url = `${baseURL}/contacts-by-phone/${userPhoneNumber}`
        // else if(keys[0] == "opportunity") url = `${baseURL}/opportunity-by-phone/${userPhoneNumber}`
        // else if(keys[0] == "dynamic") url = `${baseURL}/${flowName}/${userPhoneNumber}`
        try {
            const response = await axios.get(url, {
                headers: {
                    "X-Tenant-Id": "ll"
                }
            });
            const responseData = response.data?.[0]
            console.log("response : " ,responseData)
            const replacementValue = responseData?.[key] !== undefined ? responseData[key] : '';

            modifiedMessage = modifiedMessage.replace(placeholder[0], replacementValue);
            
        } catch (error) {
            console.error('Error fetching data for placeholder replacement:', error);

        }
    }

    console.log(modifiedMessage)
    return modifiedMessage;
}


async function getImageAndUploadToBlob(imageID, access_token) {
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

async function checkBlobExists(blockBlobClient){
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
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendProductMessage, sendListMessage, sendInputMessage, sendButtonMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, baseURL} from "./snm.js"
import  { sendProduct, sendBill, sendBillMessage, sendProductList, sendProduct_List } from "./product.js"
import { validateInput, updateStatus, replacePlaceholders, addDynamicModelInstance, addContact, executeFallback } from "./misc.js"
import { getMediaID, handleMediaUploads, checkBlobExists, getImageAndUploadToBlob } from "./handle-media.js"
import { userSessions, io } from "./server.js";
import axios from "axios";

export async function sendMessage(phoneNumber, business_phone_number_id, messageData, access_token = null, fr_flag, tenant) {

    const key = phoneNumber + business_phone_number_id;
    console.log("USESESES: ", userSessions, key)
    const userSession = userSessions.get(key);

    if (!userSession && access_token == null) {
        console.error("User session not found and no access token provided.");
        return { success: false, error: "User session or access token missing." };
    }

    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
    console.log('Sending message to:', phoneNumber);
    console.log('Message Data:', JSON.stringify(messageData, null, 3));

    // Use session access token if not provided
    if (access_token == null) access_token = userSession.accessToken;
    console.log(url, access_token)
    try {
        console.log("Senidng Details: ", phoneNumber, access_token, business_phone_number_id)
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

            let mediaURLPromise = Promise.resolve(null);
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
            
            const now = Date.now()
            const timestamp = now.toLocaleString();

                try{
                    console.log("MESSAGE DATA: ", JSON.stringify(messageData, null, 4))
                    io.emit('node-message', {
                        message: messageData,
                        phone_number_id: business_phone_number_id,
                        contactPhone: phoneNumber,
                        time: timestamp
                    });
                    console.log("Emitted  Node Message: ", messageData)
                    let formattedConversation = [{ text: messageData, sender: "bot" }];

                    try {
                        console.log("Savong convo data: ", phoneNumber, business_phone_number_id, formattedConversation ,tenant)
                        const saveRes = fetch(`${baseURL}/whatsapp_convo_post/${phoneNumber}/?source=whatsapp`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Tenant-Id': userSession.tenant || tenant,
                        },
                        body: JSON.stringify({
                            contact_id: phoneNumber,
                            business_phone_number_id: business_phone_number_id,
                            conversations: formattedConversation,
                            tenant: userSession.tenant || tenant,
                        }),
                    });

                if (!saveRes.ok) throw new Error("Failed to save conversation");
                // console.log("Conversation saved successfully");

            } catch (error) {
                console.error("Error saving conversation:", error.message);
            }
                }catch(error){
                    console.log("error occured while emission: ", error)
                }
            

            await mediaURLPromise
            return { success: true, data: response.data };

        } else {
            throw new Error("Message not sent");
        }

    } catch (error) {
        console.error('Failed to send message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

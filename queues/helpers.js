import axios from "axios";
import NodeCache from 'node-cache';
import FormData from 'form-data';

// const fastURL = "https://fastapione-gue2c5ecc9c4b8hy.centralindia-01.azurewebsites.net"

// const djangoURL = "https://backeng4whatsapp-dxbmgpakhzf9bped.centralindia-01.azurewebsites.net"
const fastURL = "http://localhost:8000"
const djangoURL = 'http://localhost:8001'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function setTemplate(templateData, phone, bpid, access_token, tenant, otp) {
try {
    console.log("otp received: ", otp);
    const components = templateData?.components || [];
    const template_name = templateData.name || "defaultTemplateName";
    const cacheKey = `${template_name}_${phone}_${bpid}_${otp}`;
    let messageData = messageCache.get(cacheKey);

    if (!messageData) {
    const res_components = [];

    for (const component of components) {
        if (component.type === "HEADER") {
        const header_handle = component?.example?.header_handle || [];
        const header_text = component?.example?.header_text || [];
        const parameters = [];

        for (const handle of header_handle) {
            const mediaID = await getMediaID(handle, bpid, access_token);
            parameters.push({
            type: "image",
            image: { id: mediaID },
            });
        }
        for (const text of header_text) {
            let modified_text = await replacePlaceholders(text, phone, bpid);
            parameters.push({
            type: "text",
            text: modified_text,
            });
        }
        if (parameters.length > 0) {
            const header_component = {
            type: "header",
            parameters: parameters,
            };
            res_components.push(header_component);
        }
        } else if (component.type === "BODY") {
        const body_text = component?.example?.body_text[0] || [];
        const parameters = [];

        for (const text of body_text) {
            let modified_text;
            if (otp) modified_text = otp;
            else modified_text = await replacePlaceholders(text, phone, bpid);

            parameters.push({
            type: "text",
            text: modified_text,
            });
        }
        if (parameters.length > 0) {
            const body_component = {
            type: "body",
            parameters: parameters,
            };
            res_components.push(body_component);
        }
        }
        else if (component.type === "CAROUSEL") {
        const cards = component?.cards || [];
        const cards_content = [];

        for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
            const card = cards[cardIndex];
            const inner_card_component = [];
            
            for (const cardComponent of card.components || []) {
            if (cardComponent.type === "HEADER") {
                const header_handle = cardComponent?.example?.header_handle || [];
                const parameters = [];

                for (const handle of header_handle) {
                const mediaID = await getMediaID(handle, bpid, access_token);
                parameters.push({
                    type: "image",
                    image: { id: mediaID }
                });
                }

                if (parameters.length > 0) {
                inner_card_component.push({
                    type: "header",
                    parameters: parameters
                });
                }
            } else if(cardComponent.type === "BODY"){
                const body_text = cardComponent?.example?.body_text[0] || [];
                const parameters = [];
    
                for (const text of body_text) {
                let modified_text;
                if (otp) modified_text = otp;
                else modified_text = await replacePlaceholders(text, phone, bpid);
    
                parameters.push({
                    type: "text",
                    text: modified_text,
                });
                }
                if (parameters.length > 0) {
                inner_card_component.push({
                    type: "body",
                    parameters: parameters
                });
                }
            } else if (cardComponent.type === "BUTTONS") {
                const buttons = cardComponent.buttons || [];
                
                buttons.forEach((button, buttonIndex) => {
                if (button.type === "QUICK_REPLY") {
                    inner_card_component.push({
                    type: "button",
                    sub_type: "quick_reply",  
                    index: buttonIndex.toString(),
                    parameters: [
                        {
                        type: "payload",
                        payload: button.text.toLowerCase().replace(/\s+/g, '-')
                        }
                    ]
                    });
                }
                });
            }
            }
            const card_component = {
            card_index: cardIndex,
            components: inner_card_component
            };
            cards_content.push(card_component);
        }

        const carousel_component = {
            type: "carousel",
            cards: cards_content
        };
        res_components.push(carousel_component);
        }
        else {
        console.warn(`Unknown component type: ${component.type}`);
        }
    }

    messageData = {
        type: "template",
        template: {
        name: template_name,
        language: {
            code: templateData?.language,
        },
        components: res_components,
        },
    };
    messageCache.set(cacheKey, messageData);
    }

    return messageData;
} catch (error) {
    console.error("Error in setTemplate function:", error);
    throw error; 
}
}

export const messageCache = new NodeCache({ stdTTL: 600 });

export async function updateStatus(status, message_id, business_phone_number_id, user_phone, broadcastGroup, tenant, timestamp) {
let isRead = false;
let isDelivered = false;
let isSent = false;
let isReplied = false;
let isFailed = false;
console.log("Sending broadcast status: ", status)
try {
    if (status === "replied") {
    isReplied = true;
    } else if (status === "read") {
    isRead = true;
    } else if (status === "delivered") {
    isDelivered = true;
    } else if (status === "sent") {
    isSent = true;
    } else if (status === "failed") {
    isFailed = true;
    }

    const data = {
    business_phone_number_id: business_phone_number_id,
    is_failed: isFailed,
    is_replied: isReplied,
    is_read: isRead,
    is_delivered: isDelivered,
    is_sent: isSent,
    user_phone: user_phone,
    message_id: message_id,
    bg_id: broadcastGroup?.id,
    bg_name: broadcastGroup?.name,
    template_name: broadcastGroup?.template_name,
    timestamp: timestamp,
    };

    console.log("Sending req to set-status (worker)")
    const response = await axios.post(`${djangoURL}/set-status/`, data, {
    headers: {
        "X-Tenant-Id": tenant,
        "Content-Type": "application/json",
    },
    });

    const key = broadcastGroup?.name || broadcastGroup?.template_name
    axios.patch(`${djangoURL}/update-contacts/`, {key: key, phone: user_phone}, {
    headers: {
        "X-Tenant-Id": tenant,
        "Content-Type": "application/json",
    }
    })

    console.log("Response received in update status(worker):", response.data);
} catch (error) {
    console.error("Error updating status:", error.response ? error.response.data : error.message);
}
}

export async function sendMessageTemplate(phoneNumber, business_phone_number_id, messageData, access_token = null, tenant) {
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
        headers: { Authorization: `Bearer ${access_token}` },
    }
    );

    let timestamp = await getIndianCurrentTime()

    try{
        console.log("MESSAGE DATA: ", JSON.stringify(messageData, null, 4))

        let formattedConversation = [{ text: messageData, sender: "bot" }];

        try {
            console.log("Saving convo data: ", phoneNumber, business_phone_number_id, formattedConversation ,tenant)
            console.log(timestamp)
            const saveRes = await axios.post(
                `${djangoURL}/whatsapp_convo_post/${phoneNumber}/?source=whatsapp`, 
                {
                    contact_id: phoneNumber,
                    business_phone_number_id: business_phone_number_id,
                    conversations: formattedConversation,
                    tenant: tenant ,
                    time: timestamp
                }, 
                {
                    headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenant,
                    },
                }
                );

                console.log("SAVE RES: ", saveRes.data)

        } catch (error) {
            console.error("Error saving conversation:", error.message);
        }
    }catch(error){
        console.log("error occured while emission: ", error)
    }
    console.log("Message sent successfully:", response.data);

    return { success: true, data: response.data };
} catch (error) {
    if (error.response) {
    console.error("Response Error:", error.response.data);
    } else if (error.request) {
    console.error("No Response Error:", error.request);
    } else {
    console.error("Setup Error:", error.message);
    }
    return { success: false, error: error.response ? error.response.data : error.message };
}
}

export async function getMediaID(handle, bpid, access_token) {
try {
    console.log("HANDLE: ", handle, bpid, access_token);
    const cacheKey = `${handle}_${bpid}_${access_token}`
    let mediaID = messageCache.get(cacheKey)

    if(!mediaID){
    const imageResponse = await axios.get(handle, { responseType: 'arraybuffer' });
    console.log("Image response received.");
    
    const formData = new FormData();
    
    formData.append('file', Buffer.from(imageResponse.data), {
    filename: 'image.jpeg',
    contentType: 'image/jpeg',
    });
    formData.append('type', 'image/jpeg');
    formData.append('messaging_product', 'whatsapp');

    const response = await axios.post(
    `https://graph.facebook.com/v20.0/${bpid}/media`,
    formData,
    {
        headers: {
        Authorization: `Bearer ${access_token}`,
        ...formData.getHeaders(),
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

export async function getIndianCurrentTime(){

const current_time = new Date()

const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
};
const indiaTime = new Intl.DateTimeFormat('en-GB', options).format(current_time);
console.log("India Time: ", indiaTime)

return indiaTime
}

export async function replacePlaceholders(message, phone, bpid) {
    
console.log("message b4 replacement: ", message) 
const placeholders = [...message.matchAll(/{{\s*[\w]+\s*}}/g)];
const response = await axios.get(`${fastURL}/contact?phone=${phone}`, {headers: {'bpid': bpid }})
const contact = response.data;
console.log("Contact: ", contact)
if(placeholders && placeholders.length > 0){
    console.log("Contact Placeholders: ", placeholders)
    for (const placeholder of placeholders) {
    let key = placeholder[0].slice(2, -2).trim();
    console.log("key:", key)
    if(['id', 'name', 'phone', 'createdOn', 'isActive', 'bg_id', 'bg_name', 'tenant'].includes(key))
    {
        const replacementValue = contact?.[key] !== undefined ? contact[key] : '';
        message = message.replace(placeholder[0], replacementValue);
    }
    else{
        const replacementValue = contact?.customField?.[key] !== undefined ? contact.customField[key] : '';
        message = message.replace(placeholder[0], replacementValue);
    }
    }
}
console.log("MEssage after replacing: " ,message)

return message;
}

export async function setTemplateData(templateData, phone, bpid, access_token) {
    try {
        const components = templateData?.components || []; // Fallback to empty array if components are missing
        const template_name = templateData.name || "defaultTemplateName"; // Fallback if template name is missing
        const cacheKey = `${template_name}_${phone}_${bpid}`;
        let messageData = messageCache.get(cacheKey);

        if (!messageData) {
        const res_components = [];

        for (const component of components) {
            if (component.type === "HEADER") {
            const header_handle = component?.example?.header_handle || [];
            const header_text = component?.example?.header_text || [];
            const parameters = [];

            for (const handle of header_handle) {
                const mediaID = await getMediaID(handle, bpid, access_token);
                parameters.push({
                type: "image",
                image: { id: mediaID },
                });
            }
            for (const text of header_text) {
                let modified_text = await replacePlaceholders(text, phone, bpid);
                parameters.push({
                type: "text",
                text: modified_text,
                });
            }
            if (parameters.length > 0) {
                const header_component = {
                type: "header",
                parameters: parameters,
                };
                res_components.push(header_component);
            }
            } else if (component.type === "BODY") {
            const body_text = component?.example?.body_text[0] || [];
            const parameters = [];

            for (const text of body_text) {
                let modified_text= await replacePlaceholders(text, phone, bpid);

                parameters.push({
                type: "text",
                text: modified_text,
                });
            }
            if (parameters.length > 0) {
                const body_component = {
                type: "body",
                parameters: parameters,
                };
                res_components.push(body_component);
            }
            }
            else if (component.type === "CAROUSEL") {
            const cards = component?.cards || [];
            const cards_content = [];

            for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
                const card = cards[cardIndex];
                const inner_card_component = [];
                
                for (const cardComponent of card.components || []) {
                if (cardComponent.type === "HEADER") {
                    const header_handle = cardComponent?.example?.header_handle || [];
                    const parameters = [];

                    for (const handle of header_handle) {
                    const mediaID = await getMediaID(handle, bpid, access_token);
                    parameters.push({
                        type: "image",
                        image: { id: mediaID }
                    });
                    }

                    if (parameters.length > 0) {
                    inner_card_component.push({
                        type: "header",
                        parameters: parameters
                    });
                    }
                } else if(cardComponent.type === "BODY"){
                    const body_text = cardComponent?.example?.body_text[0] || [];
                    const parameters = [];
        
                    for (const text of body_text) {
                    let modified_text;
                    if (otp) modified_text = otp;
                    else modified_text = await replacePlaceholders(text, phone, bpid);
        
                    parameters.push({
                        type: "text",
                        text: modified_text,
                    });
                    }
                    if (parameters.length > 0) {
                    inner_card_component.push({
                        type: "body",
                        parameters: parameters
                    });
                    }
                } else if (cardComponent.type === "BUTTONS") {
                    const buttons = cardComponent.buttons || [];
                    
                    buttons.forEach((button, buttonIndex) => {
                    if (button.type === "QUICK_REPLY") {
                        inner_card_component.push({
                        type: "button",
                        sub_type: "quick_reply",  
                        index: buttonIndex.toString(),
                        parameters: [
                            {
                            type: "payload",
                            payload: button.text.toLowerCase().replace(/\s+/g, '-')
                            }
                        ]
                        });
                    }
                    });
                }
                }
                const card_component = {
                card_index: cardIndex,
                components: inner_card_component
                };
                cards_content.push(card_component);
            }

            const carousel_component = {
                type: "carousel",
                cards: cards_content
            };
            res_components.push(carousel_component);
            }
            else {
            console.warn(`Unknown component type: ${component.type}`);
            }
        }

        messageData = {
            type: "template",
            template: {
            name: template_name,
            language: {
                code: templateData?.language,
            },
            components: res_components,
            },
        };
        messageCache.set(cacheKey, messageData);
        }

        return messageData;
    } catch (error) {
        console.error("Error in setTemplate function:", error);
        throw error; // Rethrow the error to handle it further up the call stack if needed
    }
}

export async function sendMessage(phoneNumber, business_phone_number_id, messageData, access_token = null, tenant) {

    const key = phoneNumber + business_phone_number_id;
    // console.log("USESESES: ", userSessions, key)
    const userSession = userSessions.get(key);

    if (!userSession && access_token == null) {
        console.error("User session not found and no access token provided.");
        return { success: false, error: "User session or access token missing." };
    }

    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
    console.log('Sending message to:', phoneNumber);

    phoneNumber = String(phoneNumber).trim();
    if(phoneNumber.length == 10) phoneNumber = `91${phoneNumber}`

    console.log('Message Data:', JSON.stringify(messageData, null, 7));

    // Use session access token if not provided
    if (access_token == null) access_token = userSession.accessToken;
    if (tenant == null) tenant = userSession.tenant
    // console.log(url, access_token)
    try {
        console.log("Sending Details: ", phoneNumber, access_token, business_phone_number_id)
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
            console.log("Tenant sent in send-message: ", tenant)

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
                })
            }

            let timestamp = await getIndianCurrentTime()

            console.log("MESSAGE DATA: ", JSON.stringify(messageData, null, 4))
            io.emit('node-message', {
                message: messageData,
                phone_number_id: business_phone_number_id,
                contactPhone: phoneNumber,
                time: timestamp
            });
            console.log("Emitted  Node Message: ", messageData)
            let formattedConversation = [{ text: messageData, sender: "bot" }];
            saveMessage(phoneNumber, business_phone_number_id, formattedConversation, tenant, timestamp)

            await mediaURLPromise
            // if(userSession) console.log("Current Node after sending message: ", userSession.currNode, "Next Node after sending message: ", userSession.nextNode)
            return { success: true, data: response.data };

        } else {
            throw new Error("Message not sent");
        }

    } catch (error) {
        console.error('Failed to send message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}
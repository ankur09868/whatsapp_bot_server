
import { userSessions, io, updateStatus } from "./server.js";
import axios from "axios";

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
            await updateStatus(status, messageID, business_phone_number_id, phoneNumber);

            // Prepare conversation data
            let formattedConversation = [{ text: messageData, sender: "bot" }];

            // Save conversation
            try {
                const saveRes = await fetch(`https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_convo_post/${phoneNumber}/?source=whatsapp`, {
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

  
export async function sendTextMessage(userPhoneNumber, business_phone_number_id,message, access_token = null){
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token)
}  
  
export async function sendImageMessage(phoneNumber, business_phone_number_id, imageUrl, caption, access_token = null) {
    const messageData = {
        type: "image",
        image: {
            link: imageUrl,
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
    const key = userPhoneNumber + business_phone_number_id
    const userSession = userSessions.get(key);
    console.log("user session: ", userSession)
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
        
        switch (flow[currNode]?.type) {
            case "Button":
                const buttons = nextNode
                node_message = await replacePlaceholders(node_message, userSession)
        
                await sendButtonMessage(buttons, node_message, userPhoneNumber,business_phone_number_id);
                break;
         
            case "List":
                const list = nextNode
                node_message = await replacePlaceholders(node_message, userSession)
        
                await sendListMessage(list, node_message, userPhoneNumber,business_phone_number_id, accessToken);
                break;
            case "Input":
                node_message = await replacePlaceholders(node_message, userSession)
        
                userSession.inputVariable=flow[currNode]?.Input[0] //name
                // userSession.inputVariableType = flow[currNode]?.InputType[0]
                console.log("input variable: ", userSession.inputVariable)
                const data = {phone_no : BigInt(userPhoneNumber).toString()}
                const modelName = `${business_phone_number_id}`
                await addDynamicModelInstance(modelName, data)
                await sendInputMessage(userPhoneNumber,business_phone_number_id, node_message);
                break;
              
            case "string":
                node_message = await replacePlaceholders(node_message, userSession)
        
                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);
                userSession.currNode = nextNode[0] || null;
                console.log("string currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    await sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            case "image":

                await sendImageMessage(userPhoneNumber,business_phone_number_id, flow[currNode]?.body?.url, flow[currNode]?.body?.caption ,accessToken);
                userSession.currNode = nextNode[0] || null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    await sendNodeMessage(userPhoneNumber,business_phone_number_id)
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
    }
    else{
        userSession.currNode = 0;
        userSession.nextNode = adjListParsed[userSession.currNode] || [];
    }
}

export async function addDynamicModelInstance(modelName, updateData) {
    const url = `https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/${modelName}/`;
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


export async function replacePlaceholders(message, userSession =null, userPhoneNumber = null, tenant = null) {
    if (userSession != null){
        var userPhoneNumber = userSession.userPhoneNumber;
        var tenant = userSession.tenant;
    }
    
    let modifiedMessage = message;

    const placeholders = [...message.matchAll(/{{\s*[\w]+\s*}}/g)];
    
    for (const placeholder of placeholders) {
        let key = placeholder[0].slice(2, -2).trim();
        
        try {
            const response = await axios.get(`https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/contacts-by-phone/${userPhoneNumber}`, {
                headers: {
                    "X-Tenant-Id": tenant
                }
            });
            const responseData = response.data?.[0]
            const replacementValue = responseData[key] !== undefined ? responseData[key] : '';

            modifiedMessage = modifiedMessage.replace(placeholder[0], replacementValue);
            
        } catch (error) {
            console.error('Error fetching data for placeholder replacement:', error);

        }
    }

    console.log(modifiedMessage)
    return modifiedMessage;
}
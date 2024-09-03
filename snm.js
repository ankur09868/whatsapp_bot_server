import { userSessions, io, updateStatus } from "./new_shreyas_server.js";
import axios from "axios";
import { inputVariable, setInputVariable } from "./globals.js";

export async function sendMessage(phoneNumber, business_phone_number_id, messageData, access_token = null) {
    const key = phoneNumber + business_phone_number_id
    const userSession = userSessions.get(key)
    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
    console.log('Sending message to:', phoneNumber);
    console.log('Message Data:', messageData);
    if(access_token == null) access_token = userSession.accessToken
    try {
        const response = await axios.post(url, {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            ...messageData
        },
        {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        console.log('Message sent successfully:', response.data);
        const messageID = response.data?.messages?.[0]?.id
        const status = "sent";
        await updateStatus(status, messageID,  business_phone_number_id, phoneNumber)
        return { success: true, data: response.data };
    } catch (error) {
        console.error('Failed to send message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}
  
export async function sendTextMessage(userPhoneNumber, business_phone_number_id,message, access_token = null){
    const userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
    console.log("user session: ", userSession)
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
    console.log("USER SESSION: ", userSession)
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
    
    if (typeof currNode !== 'undefined' && currNode !== null && adjListParsed) {
        const nextNode = adjListParsed[currNode];
        const node_message = flow[currNode]?.body;
        
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
                await sendButtonMessage(buttons, node_message, userPhoneNumber,business_phone_number_id);
                break;
         
            case "List":
                const list = nextNode
                await sendListMessage(list, node_message, userPhoneNumber,business_phone_number_id, accessToken);
                break;
            case "Input":
                setInputVariable(flow[currNode]?.Input[0]) //name
                console.log("input variable: ", inputVariable)
                await createDynamicModelInstance('ModelName', userPhoneNumber)
                await sendInputMessage(userPhoneNumber,business_phone_number_id, node_message);
                break;
              
            case "string":
                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);
                userSession.currNode = nextNode[0] || null;
                console.log("string currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    await sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            case "image":
                await sendImageMessage(userPhoneNumber,business_phone_number_id, node_message, flow[currNode]?.body?.url, accessToken);
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

export async function createDynamicModelInstance(modelName, phone) {
    const url = `http://localhost:8000/dynamic-model-data/${modelName}/`;
    const data = {phone_no: phone}
    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': 'll'
            }
        });
        console.log('dynamic instance created', response.data);
        return response.data;
    } catch (error) {
        console.error(`Failed to add data: ${error.message}`);
        console.error(error);
        return null;
    }    
}

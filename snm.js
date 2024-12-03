import { userSessions, messageCache } from "./server.js";
import {sendMessage} from "./send-message.js"

import { replacePlaceholders, addDynamicModelInstance, addContact, executeFallback } from "./misc.js"
import { getMediaID } from "./handle-media.js"


// export const fastURL = "https://fastapione-gue2c5ecc9c4b8hy.centralindia-01.azurewebsites.net"
// export const djangoURL = "https://backeng4whatsapp-dxbmgpakhzf9bped.centralindia-01.azurewebsites.net"

export const fastURL = "http://localhost:8000"
export const djangoURL = "http://localhost:8001"

export async function sendLocationMessage(phone, bpid, body, access_token=null,tenant_id=null, fr_flag = false) {
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

    return sendMessage(phone, bpid, messageData, access_token, fr_flag, tenant_id)
}

export async function sendVideoMessage(phone, bpid, videoID, access_token=null, tenant_id=null, fr_flag = false) {
    const messageData = {
        type : "video",
        video : {
            id: videoID
        }
    }
    return sendMessage(phone, bpid, messageData, access_token, fr_flag, tenant_id)
}

export async function sendAudioMessage(phone, bpid, audioID, caption, access_token=null,tenant_id=null, fr_flag = false) {
    const audioObject = {}
    if(audioID) audioObject.id = audioID
    if(caption) audioObject.caption = caption
  const messageData = {
    type: "audio",
    audio: audioObject
  }
  return sendMessage(phone, bpid, messageData, access_token, fr_flag, tenant_id)
}
  
export async function sendTextMessage(userPhoneNumber, business_phone_number_id,message, access_token = null, tenant_id=null ,fr_flag = false){
    console.log("cCess:token: ", access_token)
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)
} 
 
export async function sendImageMessage(phoneNumber, business_phone_number_id, imageID, caption, access_token = null, tenant_id=null, fr_flag= false) {
    const imageObject = {}
    if(imageID) imageObject.id = imageID
    if(caption) imageObject.caption = caption
    const messageData = {
        type: "image",
        image: imageObject
    };
    console.log("IMAGEEEE");
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag ,tenant_id);
}
 
export async function sendButtonMessage(buttons, message, phoneNumber, business_phone_number_id,  mediaID = null, access_token = null,tenant_id=null, fr_flag = false) {
    console.log("phone number: ", phoneNumber, business_phone_number_id)
    const key = phoneNumber + business_phone_number_id
    // console.log("USER SESSIONS: ", userSessions, key)
    const userSession = userSessions.get(key);
    // console.log("USER SESSION: ", userSession)
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
        if(mediaID !== null && mediaID !== undefined) {
            console.log("media id present")
            messageData.interactive['header'] = { type: 'image', image: {id: mediaID}}
        }
        return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)
    } catch (error) {
        console.error('Failed to send button message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

export async function sendInputMessage(userPhoneNumber, business_phone_number_id,message, access_token = null,tenant_id=null, fr_flag = false){
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)
}

export async function sendListMessage(list, message, phoneNumber, business_phone_number_id, access_token =  null,tenant_id=null, fr_flag = false) {
    const key = phoneNumber + business_phone_number_id
    // console.log("USER SESSIONS: ",  userSessions, key)
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
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id);
}

export async function sendProductMessage(userSession, product_list, catalog_id, header, body, footer, tenant_id = null, fr_flag = false){
    let productMessageData;
    // single product
    if (product_list.length == 1){
        productMessageData = {
            type: "interactive",
            interactive: {
                type: "product",
                action: {
                    catalog_id: catalog_id,
                    product_retailer_id: product_list[0]
                }
            }
        }
        if(body) productMessageData.interactive['body'] = {text: body}
        if(footer) productMessageData.interactive['footer'] = {text: footer}
    }
    // multiple products
    else{
        let sections = []
        for (let product of product_list){
            let section ={}
            section['title'] = "This is Title"
            section['product_items'] = []
            console.log("product: ", product)
            section['product_items'].push({product_retailer_id: product})
            console.log("SEction: ", section)
            sections.push(section)
        }
        console.log("sections: ", JSON.stringify(sections, null, 4))
        productMessageData = {
            type: "interactive",
            interactive: {
                type: "product_list",
                header: {
                    type: "text",
                    text: header
                },
                body: {
                    text: body || "this is body"
                },
                action: {
                    catalog_id: catalog_id,
                    sections: sections
                }
            }
        }
        if(footer) productMessageData.interactive['footer'] = {text: footer}
    }
    console.log("Message Data ", JSON.stringify(productMessageData, null, 4))
    await sendMessage(userSession.userPhoneNumber, userSession.business_number_id, productMessageData, userSession.accessToken, fr_flag, tenant_id)
}

export async function sendNodeMessage(userPhoneNumber, business_phone_number_id) {
    const key = userPhoneNumber + business_phone_number_id
    const userSession = userSessions.get(key);
    if (!userSession) {
        console.error(`No session found for user ${userPhoneNumber} and ${business_phone_number_id}`);
        return;
    }

    const { flowData, adjList, currNode, accessToken } = userSession;
    const flow = flowData;
    const adjListParsed =adjList;
    console.log(currNode)
    const delay = flow[currNode]?.delay;
    if(delay !== undefined && delay > 0){
        userSession.flowData[currNode].delay = 0
        console.log(`delayed by ${delay} seconds`)
        setTimeout(() => {
            sendNodeMessage(userPhoneNumber, business_phone_number_id);
        }, delay * 1000)
        return;
    }
    if (typeof currNode !== 'undefined' && currNode !== null && adjListParsed) {
        
        const nextNode = adjListParsed[currNode];
        var node_message = flow[currNode]?.body;
        
        let sendMessagePromise;
        let sendDynamicPromise;
        console.log("flowlfolwolfowl: ", flow[currNode])
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
                    sendDynamicPromise = addDynamicModelInstance(modelName, data, userSession.tenant)
                }
                let mediaID = flow[currNode]?.mediaID
                await sendButtonMessage(buttons, node_message, userPhoneNumber,business_phone_number_id, mediaID );
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
                    sendDynamicPromise = addDynamicModelInstance(modelName, data, userSession.tenant)
                }
                await sendListMessage(list, node_message, userPhoneNumber,business_phone_number_id, accessToken);
                break;
            
            // text with variable
            case "Text":

                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                 
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                    
                    console.log("input variable: ", userSession.inputVariable)
                    var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    var modelName = userSession.flowName
                    sendDynamicPromise = addDynamicModelInstance(modelName, data, userSession.tenant)
                }

                sendMessagePromise = sendInputMessage(userPhoneNumber,business_phone_number_id, node_message);
                break;
              
            // text without variable
            case "string":
                
                var placeholders = [...node_message.matchAll(/{{\s*[\w]+\s*}}/g)];
                if(placeholders.length > 0) node_message = await replacePlaceholders(node_message, userSession)
                
                
                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message, );
                console.log(nextNode[0])
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("string currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "image":
                var caption = flow[currNode]?.body?.caption

                if(caption !== undefined){
                    var placeholders = [...caption.matchAll(/{{\s*[\w]+\s*}}/g)];
                    if(placeholders.length > 0) caption = await replacePlaceholders(node_message, userSession)
                }

                await sendImageMessage(userPhoneNumber,business_phone_number_id, flow[currNode]?.body?.id, flow[currNode]?.body?.caption ,accessToken);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "audio":
                const audioID = flow[currNode]?.body?.audioID

                var caption = flow[currNode]?.body?.caption
                if(caption !== undefined){
                    var placeholders = [...caption.matchAll(/{{\s*[\w]+\s*}}/g)];
                    if(placeholders.length > 0) caption = await replacePlaceholders(node_message, userSession)
                }

                sendMessagePromise  = await sendAudioMessage(userPhoneNumber, business_phone_number_id, audioID, caption, accessToken);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("audio currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "video":
                sendMessagePromise = sendVideoMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body?.videoID, accessToken);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("video currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "location":

                sendMessagePromise = sendLocationMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body , accessToken)
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            case "AI":
                console.log("AI Node")
                if(node_message) await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);

                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                
                    console.log("input variable: ", userSession.inputVariable)
                }
                userSession.AIMode = true;
                break;
                
            case "product":
                const product_list = flow[currNode]?.product
                const catalog_id = flow[currNode]?.catalog_id
                const body = flow[currNode]?.body
                const footer = flow[currNode]?.footer
                const header = flow[currNode]?.header || "This is Header"
                await sendProductMessage(userSession, product_list, catalog_id,header, body, footer)
                break;
            
            default:
                console.log(`Unknown node type: ${flow[currNode]?.type}`);
            }
        userSession.nextNode = nextNode;
        userSessions.set(userPhoneNumber+business_phone_number_id, userSession);
        await Promise.all([sendMessagePromise, sendDynamicPromise])
    }
    else{
        userSession.currNode = userSession.startNode;
        userSession.nextNode = adjListParsed[userSession.currNode] || [];
    }
    
}

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

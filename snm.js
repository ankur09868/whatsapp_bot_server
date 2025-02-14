import { userSessions, messageCache } from "./server.js";
import {sendMessage} from "./send-message.js"
import axios from "axios";
import { convertImageToBase64 } from "./flowsAPI/flow.js";
import { replacePlaceholders, addDynamicModelInstance, executeFallback } from "./helpers/misc.js"
import { getMediaID } from "./helpers/handle-media.js"
import { json } from "express";
import { handleTextOrdersForDrishtee, handleAudioOrdersForDrishtee } from "./webhooks/userWebhook.js";
import { realtorWebhook } from "./webhooks/realtorWebhook.js";


export const fastURL = "https://fastapione-gue2c5ecc9c4b8hy.centralindia-01.azurewebsites.net"
export const djangoURL = "https://backeng4whatsapp-dxbmgpakhzf9bped.centralindia-01.azurewebsites.net"

// export const fastURL = "http://localhost:8000"
// export const djangoURL = "http://localhost:8001"

const viewItemsMap = {
    'hi': 'वस्तुएं देखें', // Hindi - Vastuon Dekhein (Formal)
    'en': 'View Items', // English
    'mr': 'वस्तू पहा', // Marathi - Vastoo Paha
    'ta': 'உருப்படிகளைப் பார்க்கவும்', // Tamil - Uruppadigalai Paarkavum
    'te': 'వస్తువులను చూడండి', // Telugu - Vastuvulanu Choodandi
    'gu': 'વસ્તુઓ જુઓ', // Gujarati - Vastuo Juo
    'bn': 'বস্তুগুলি দেখুন', // Bengali - Bostuguli Dekhun
    'pa': 'ਵਸਤਾਂ ਵੇਖੋ', // Punjabi - Vastan Vekho
    'ml': 'വസ്തുക്കൾ കാണുക', // Malayalam - Vastrukkal Kaanku
    'kn': 'ವಸ್ತುಗಳನ್ನು ವೀಕ್ಷಿಸಿ', // Kannada - Vastugalu Veekshisi
    'or': 'ବସ୍ତୁଗୁଡ଼ିକ ଦେଖନ୍ତୁ', // Odia - Bastugudika Dekhantu
    'as': 'বস্তুবোৰ চাওক', // Assamese - Bostubor Chaok
    'ks': 'اشیاء دیکھیں', // Kashmiri - Ashiya Dekhein
    'ur': 'اشیاء دیکھیں', // Urdu - Ashiya Dekhein
    'ne': 'वस्तुहरू हेर्नुहोस्', // Nepali - Vastuharu Hernuhos
    'sa': 'वस्तूनि पश्यत', // Sanskrit - Vastuuni Pashyata
    'mai': 'वस्तु देखू', // Maithili - Vastu Dekhu
    'doi': 'वस्तुएं देखो', // Dogri - Vastu Dekho
    'kok': 'वस्तू पाहा', // Konkani - Vastoo Paha
    'bodo': 'वस्तु सायाय', // Bodo - Vastu Saayaya
    'sd': 'شيون ڏسو', // Sindhi - Shiyon Diso
    'mni': 'বস্তু চাও', // Manipuri - Bostu Chao
    'sat': 'ᱵᱟᱵᱤᱭᱥ ᱦᱤᱞᱟᱹᱜᱤ', // Santhali - Babiyis Hilaygi
    'bho': 'सामान देखीं', // Bhojpuri - Samaan Dekhin
    'hing': 'View Items', // Hinglish
};
 
export const chooseOptionMap = {
    'hi': 'विकल्प चुनें', // Hindi
    'en': 'Choose Option', // English
    'mr': 'पर्याय निवडा', // Marathi
    'ta': 'விருப்பத்தைத் தேர்ந்தெடுக்கவும்', // Tamil
    'te': 'ఎంపికను ఎంచుకోండి', // Telugu
    'gu': 'વિકલ્પ પસંદ કરો', // Gujarati
    'bn': 'বিকল্প নির্বাচন করুন', // Bengali
    'pa': 'ਵਿਕਲਪ ਚੁਣੋ', // Punjabi
    'ml': 'ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക', // Malayalam
    'kn': 'ಆಯ್ಕೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ', // Kannada
    'or': 'ବିକଳ୍ପ ଚୟନ କରନ୍ତୁ', // Odia
    'as': 'বিকল্প বাচনি কৰক', // Assamese
    'ks': 'آپشن منتخب کریں', // Kashmiri
    'ur': 'آپشن منتخب کریں', // Urdu
    'ne': 'विकल्प छान्नुहोस्', // Nepali
    'sa': 'विकल्पं चुनोतु', // Sanskrit
    'mai': 'विकल्प चुनू', // Maithili
    'doi': 'विकल्प चुनो', // Dogri
    'kok': 'पर्याय निवडा', // Konkani
    'bodo': 'अभिराम सन्थार', // Bodo
    'sd': 'چونڊ جو آپشن', // Sindhi
    'mni': 'অপশন নির্বাচন করুন', // Manipuri
    'sat': 'ᱥᱟᱹᱵᱟᱭ ᱢᱤᱭᱤᱭ ᱵᱤᱦᱤᱭ', // Santhali
    'bho': 'विकल्प चुनीं', // Bhojpuri
    'hing': 'Choose Option', // Hinglish
};

export const pickCategoryMap = {
'hi': 'कृपया एक श्रेणी चुनें', // Hindi
'en': 'Please pick a category', // English
'mr': 'कृपया एक श्रेणी निवडा', // Marathi
'ta': 'தயவுசெய்து ஒரு பிரிவைத் தேர்ந்தெடுக்கவும்', // Tamil
'te': 'దయచేసి ఒక వర్గాన్ని ఎంచుకోండి', // Telugu
'gu': 'કૃપયા એક શ્રેણી પસંદ કરો', // Gujarati
'bn': 'দয়া করে একটি বিভাগ নির্বাচন করুন', // Bengali
'pa': 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਸ਼੍ਰੇਣੀ ਚੁਣੋ', // Punjabi
'ml': 'ദയവായി ഒരു വിഭാഗം തിരഞ്ഞെടുക്കുക', // Malayalam
'kn': 'ದಯವಿಟ್ಟು ಒಂದು ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ', // Kannada
'or': 'ଦୟାକରି ଏକ ଶ୍ରେଣୀ ବାଛନ୍ତୁ', // Odia
'as': 'অনুগ্রহ কৰি একটি শ্রেণী বাছুন', // Assamese
'ks': 'براہ کرم ایک زمرہ منتخب کریں', // Kashmiri
'ur': 'براہ کرم ایک زمرہ منتخب کریں', // Urdu
'ne': 'कृपया एक श्रेणी छान्नुहोस्', // Nepali
'sa': 'कृपया एक श्रेणी चयनित करें', // Sanskrit
'mai': 'कृपया एक श्रेणी चुनू', // Maithili
'doi': 'कृपया एक श्रेणी चुनो', // Dogri
'kok': 'कृपया एक श्रेणी निवडा', // Konkani
'bodo': 'कृपया एक श्रेणी चयन करा', // Bodo
'sd': 'مهرباني ڪري هڪ ڪيٽيگري چونڊيو', // Sindhi
'mni': 'অনুগ্রহ করে একটি বিভাগ নির্বাচন করুন', // Manipuri
'sat': 'ᱥᱟᱹᱵᱟᱭ ᱢᱤᱭᱤᱭ ᱵᱤᱦᱤᱭ', // Santhali
'bho': 'कृपया एक श्रेणी चुनीं', // Bhojpuri
'hing': 'Please pick a category', // Hinglish
};

export async function sendLocationMessage(phone, bpid, body, access_token=null,tenant_id=null) {
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

    return sendMessage(phone, bpid, messageData, access_token, tenant_id)
}

export async function sendVideoMessage(phone, bpid, videoID, access_token=null, tenant_id=null, caption = null) {
    const messageData = {
        type : "video",
        video : {
            id: videoID
        }
    }
    if (caption) messageData.video.caption = caption
    return sendMessage(phone, bpid, messageData, access_token, tenant_id)
}

export async function sendAudioMessage(phone, bpid, audioID, caption, access_token=null,tenant_id=null) {
    const audioObject = {}
    if(audioID) audioObject.id = audioID
    if(caption) audioObject.caption = caption
  const messageData = {
    type: "audio",
    audio: audioObject
  }
  return sendMessage(phone, bpid, messageData, access_token, tenant_id)
}
  
export async function sendTextMessage(userPhoneNumber, business_phone_number_id,message, access_token, tenant_id){
    console.log("cCess:token: ", access_token)
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
} 
 
export async function sendImageMessage(phoneNumber, business_phone_number_id, imageID, caption, access_token = null, tenant_id=null) {
    const imageObject = {}
    if(imageID) imageObject.id = imageID
    if(caption) imageObject.caption = caption
    const messageData = {
        type: "image",
        image: imageObject
    };
    console.log("IMAGEEEE");
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token ,tenant_id);
}

export async function sendButtonMessage(buttons, message, phoneNumber, business_phone_number_id,  mediaID = null, access_token = null,tenant_id=null) {
    const key = phoneNumber + business_phone_number_id
    const userSession = userSessions.get(key);
    const flow = userSession.flowData
    try {
        let button_rows = buttons.map(buttonNode => ({
            type: 'reply',
            reply: {
                id: flow[buttonNode].id,
                title: (flow[buttonNode].body).slice(0 , 20)
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
            messageData.interactive['header'] = { type: 'image', image: {id: mediaID}}
        }
        return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
    } catch (error) {
        console.error('Failed to send button message:', error.response ? error.response.data : error.message);
        return { success: false, error: error.response ? error.response.data : error.message };
    }
}

export async function sendInputMessage(userPhoneNumber, business_phone_number_id,message, access_token = null,tenant_id=null){
    const messageData = {
        type: "text",
        text: { body: message }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
}

export async function sendListMessage(list, message, phoneNumber, business_phone_number_id, access_token =  null,tenant_id=null) {
    const key = phoneNumber + business_phone_number_id
    // console.log("USER SESSIONS: ",  userSessions, key)
    const userSession = userSessions.get(key);
    const flow = userSession.flowData
    
    const rows = list.map((listNode, index) => ({
        id: flow[listNode].id,
        title: (flow[listNode].body).slice(0 , 24)
    }));
    console.log(userSession.language)
    console.log("OPTION CHOOSING RESULT: ", chooseOptionMap[`${userSession.language}`] )
    const messageData = {
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: message },
            action: {
                button: chooseOptionMap[`${userSession.language}`] || "Choose Option:",
                sections: [{ title: "Section Title", rows }]
            }
        }
    };
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, tenant_id);
}

export async function sendProductMessage(userSession, product_list, catalog_id, header, body, footer, section_title, tenant_id = null){
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
        let section = {
            title: section_title,
            product_items: []
        };
    
        for (let product of product_list) {
            console.log("product: ", product);
            section['product_items'].push({ product_retailer_id: product });
        }
        let sections = [section];
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
                    text: body
                },
                action: {
                    button: "Start Shopping",
                    catalog_id: catalog_id,
                    sections: sections
                }
            }
        }
        if(footer) productMessageData.interactive['footer'] = {text: footer}
    }
    console.log("Message Data ", JSON.stringify(productMessageData, null, 4))
    await sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, productMessageData, userSession.accessToken, tenant_id)
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
    console.log("Current Node: ",currNode)
    let delay;
    if(currNode) delay = flow[currNode]?.delay;
    if(delay !== undefined && delay > 0){
        userSession.flowData[currNode].delay = 0
        console.log(`delayed by ${delay} seconds`)
        setTimeout(() => {
            sendNodeMessage(userPhoneNumber, business_phone_number_id);
        }, delay * 1000)
        return;
    }

    if (typeof currNode !== undefined && currNode !== null && adjListParsed) {
        const nextNode = adjListParsed[currNode];
        let node_message = flow[currNode]?.body;
        console.log("flowlfolwolfowl: ", flow[currNode])
        
        switch (flow[currNode]?.type) {
            case "Button":
                const buttons = nextNode
                node_message = await replacePlaceholders(node_message, userSession)
                
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable

                    // userSession.inputVariableType = flow[currNode]?.InputType[0]
                    console.log("input variable: ", userSession.inputVariable)
                    // var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    // var modelName = userSession.flowName
                    // addDynamicModelInstance(modelName, data, userSession.tenant)
                }

                let mediaID = flow[currNode]?.mediaID
                console.log("Information for buttons: ", buttons, node_message)
                await sendButtonMessage(buttons, node_message, userPhoneNumber,business_phone_number_id, mediaID );
                break;
                
            case "List":
                const list = nextNode
                node_message = await replacePlaceholders(node_message, userSession)

                
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                
                    console.log("input variable: ", userSession.inputVariable)
                    // var data = {phone_no : BigInt(userPhoneNumber).toString()}
                    // var modelName = userSession.flowName
                    // addDynamicModelInstance(modelName, data, userSession.tenant)
                }
                await sendListMessage(list, node_message, userPhoneNumber,business_phone_number_id, accessToken);
                break;
            
            case "Text":
                node_message = await replacePlaceholders(node_message, userSession)

                 
                var variable = flow[currNode]?.variable
                if(variable) {
                    userSession.inputVariable = variable
                    
                    console.log("input variable: ", userSession.inputVariable)
                //     var data = {phone_no : BigInt(userPhoneNumber).toString()}
                //     var modelName = userSession.flowName
                //     addDynamicModelInstance(modelName, data, userSession.tenant)
                }

                await sendInputMessage(userPhoneNumber,business_phone_number_id, node_message);
                
                // userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;

                break;
            
            case "string":
                    
                node_message = await replacePlaceholders(node_message, userSession)

                await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message, userSession.accessToken, userSession.tenant);
                // console.log(nextNode[0])
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("string currNode: ", userSession.currNode)

                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "image":
                var caption =flow[currNode]?.body?.caption

                if(caption) caption = await replacePlaceholders(caption, userSession)
                
                await sendImageMessage(userPhoneNumber,business_phone_number_id, flow[currNode]?.body?.id, caption ,accessToken);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "audio":
                const audioID = flow[currNode]?.body?.audioID

                var caption = flow[currNode]?.body?.caption
                if(caption) caption = await replacePlaceholders(caption, userSession)


                await sendAudioMessage(userPhoneNumber, business_phone_number_id, audioID, caption, accessToken);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("audio currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "video":

                var caption = flow[currNode]?.body?.caption
                if(caption) caption = await replacePlaceholders(caption, userSession)

                await sendVideoMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body?.videoID, accessToken, userSession?.tenant, caption);
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("video currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "location":
                node_message = await replacePlaceholders(node_message, userSession)

                sendLocationMessage(userPhoneNumber, business_phone_number_id, flow[currNode]?.body , accessToken)
                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("image currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "AI":
                console.log("AI Node")
                if(node_message){
                    node_message = await replacePlaceholders(node_message, userSession)
                    await sendTextMessage(userPhoneNumber,business_phone_number_id, node_message);
                }
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
                const header = flow[currNode]?.header 
                const section_title = flow[currNode]?.section_title
                await sendProductMessage(userSession, product_list, catalog_id,header, body, footer, section_title)
                // userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                // console.log("video currNode: ", userSession.currNode)
                // if(userSession.currNode!=null) {
                //     sendNodeMessage(userPhoneNumber,business_phone_number_id)
                // }
                break;
            
            case "api":
                const api = flow[currNode]?.api
                const method = api?.method

                let headers = api?.headers
                if(headers) headers = JSON.parse(headers)
                console.log("Type of headers: ", typeof(headers))
                const url = api?.endpoint

                if(method == "GET"){
                    const variable_name = api?.variable
                    console.log("Variable Name: ", variable_name)
                    const response = await axios.get(url, {headers: headers})
                    console.log("Received Response from GET req: ", response.data)
                    userSession.api.GET[`${variable_name}`] = response.data
                    console.log("User Session after GET: ", userSession)
                }
                else if(method == 'POST'){
                    console.log("Entering API-POST")
                    const variables = api?.variable
                    const variableList = variables?.split(',').map(item => item.trim());
                    console.log("Variables: ", typeof(variableList))

                    const dataToSend = {}

                    for (const variable of variableList){
                        console.log("Var: ", variable)
                        const value = userSession.api.POST?.[variable] 
                        console.log(value)
                        dataToSend[variable] = value
                    }
                    console.log("Data to Send: ", dataToSend)
                    axios.post(url, dataToSend, {headers: head})
                    console.log("Sending POST req with data: ", dataToSend)
                }
                else if(method == "DELETE"){

                }

                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;
                console.log("string currNode: ", userSession.currNode)
                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;
            
            case "template":
                
                let templateName = flow[currNode]?.name
                if(userSession.multilingual) templateName = userSession.language ? `${flow[currNode]?.name}${userSession.language}`  : flow[currNode]?.name
                if(userSession.tenant == "qqeeusz"){
                    if(userSession.language == "mr") templateName = "carouseldrishteemar"
                    if(userSession.language == "bn") templateName = "carouseldrishteeben"
                }
                else if(userSession.tenant == "leqcjsk"){
                    if(userSession.language == "mr") templateName = "carouseldrishteemar"
                }
                else if(userSession.tenant == "shxivoa"){
                    console.log("User Session Team: ", userSession.team)
                    templateName = flow[currNode]?.[userSession.team]
                    // if(userSession.team == "Juventus") templateName = flow[currNode]?.[userSession.team]
                    // if(userSession.team == "Chelsea") templateName = ""
                    // if(userSession.team == "Liverpool") templateName = ""

                }
                console.log("Language: ", userSession.language, "Name: ", templateName)
                userSession.inputVariable = "Temp"
                await sendTemplateMessage(templateName, userSession)

                break;
            
            case "custom":
                const customCode = flow[currNode]?.customCode
                if(customCode == "other_programs"){
                    let messageData;

                    if(userSession.team == "Juventus") messageData = await customButtonMessageForFC("Liverpool", "Chelsea")
                    if(userSession.team == "Chelsea") messageData = await customButtonMessageForFC("Juventus", "Liverpool")
                    if(userSession.team == "Liverpool") messageData = await customButtonMessageForFC("Chelsea", "Juventus")
                    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
                    break;
                }
                await handleCustomNode(customCode, userSession)

                userSession.currNode = nextNode[0] !==undefined ? nextNode[0] : null;

                if(userSession.currNode!=null) {
                    sendNodeMessage(userPhoneNumber,business_phone_number_id)
                }
                break;

            default:
                console.log(`Unknown node type: ${flow[currNode]?.type}`);  
        }
    
        userSession.nextNode = nextNode;
        userSessions.set(userPhoneNumber+business_phone_number_id, userSession);
        // await Promise.all([sendMessagePromise, sendDynamicPromise])
    }else{
        userSession.currNode = userSession.startNode;
        userSession.nextNode = adjListParsed[userSession.currNode] || [];
    }
}

async function customButtonMessageForFC(fc1, fc2){
    return {
        type: "interactive",
        interactive: {
            type: "button",
            body: {text: "We also offer:"},
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: fc1,
                            title: fc1
                        }
                    },
                    {
                        type: "reply",
                        reply: {
                            id: fc2,
                            title: fc2
                        }
                    }
                ]
            }
        }
    }
}

export async function setTemplateData(templateName, userSession){
    let responseData = messageCache.get(userSession.business_phone_number_id);

    if (!responseData) {
      try {
        const response = await axios.get(`${fastURL}/whatsapp_tenant`, {
          headers: { bpid: userSession.business_phone_number_id },
        });
        responseData = response.data;
        messageCache.set(business_phone_number_id, responseData);
      } catch (error) {
        console.error(`Error fetching tenant data: ${error.message}`);
        throw new Error("Failed to fetch tenant data.");
      }
    }

    const access_token = responseData?.whatsapp_data[0]?.access_token;
    const account_id = responseData?.whatsapp_data[0]?.business_account_id;
    const tenant_id = responseData?.whatsapp_data[0]?.tenant_id

    if (!access_token || !account_id) {
      throw new Error("Invalid tenant data. Missing access token or account ID.");
    }

    const cacheKey = `${account_id}_${templateName}`;
    let graphResponse = messageCache.get(cacheKey);

    // Fetch template data if not available in cache
    if (!graphResponse) {
      try {
        const response = await axios.get(
          `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        graphResponse = response.data;
        messageCache.set(cacheKey, graphResponse);
      } catch (error) {
        console.error(`Error fetching template: ${error.message}`);
        throw new Error("Failed to fetch template data from the API.");
      }
    }

    if (!graphResponse?.data || graphResponse.data.length === 0) {
      throw new Error("Template not found.");
    }

    const templateData = graphResponse.data[0];

    

    const messageData = await setTemplateCar(
    templateData,
    userSession.userPhoneNumber,
    userSession.business_phone_number_id,
    userSession.accessToken
    );

    console.log("Message Data: ", messageData);
    return messageData;
}

export async function sendTemplateMessage(templateName, userSession) {
    
    // Send message template
    const messageData = await setTemplateData(templateName, userSession);

    const sendMessageResponse = await sendMessageTemplate(
    userSession.userPhoneNumber,
    userSession.business_phone_number_id,
    messageData,
    userSession.accessToken,
    userSession.tenant
    );
    
}

export async function setTemplateCar(templateData, phone, bpid, access_token) {
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
                let modified_text = await replacePlaceholders(text, undefined, phone);
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
                let modified_text= await replacePlaceholders(text, undefined, phone);

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
                    else modified_text = await replacePlaceholders(text, undefined, phone);
        
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
                        tenant: tenant || userSession?.tenant,
                        time: timestamp
                    }, 
                    {
                        headers: {
                        'Content-Type': 'application/json',
                        'X-Tenant-Id': tenant
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

const customMap = {

}

async function generatePropertyRichText(propertyDetails) {
    const output = [];
    
    if (propertyDetails.image) {
      output.push(`![Property Image](${propertyDetails.image})`);
    }
  
    // Section builder with conditional headings
    const buildSection = (title, items) => {
      if (items.length === 0) return;
      output.push(`*${title.toUpperCase()}*`);
      output.push(...items);
      output.push('╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌');
    };
  
    // Core Information
    const coreInfo = [];
    if (propertyDetails.bhk) coreInfo.push(`🛏️ *${propertyDetails.bhk} BHK*`);
    if (propertyDetails.property_type) coreInfo.push(`🏠 _Type:_ ${propertyDetails.property_type}`);
    if (propertyDetails.preferred_tenant) coreInfo.push(`👤 _Tenant Preference:_ ${propertyDetails.preferred_tenant}`);
    if (propertyDetails.possession) coreInfo.push(`📅 _Possession:_ ${propertyDetails.possession}`);
    buildSection('Property Overview', coreInfo);
  
    // Structural Details
    const structure = [];
    if (propertyDetails.floor) structure.push(`↕️ _Floor:_ ${propertyDetails.floor}`);
    if (propertyDetails.facing) structure.push(`🧭 _Facing:_ ${propertyDetails.facing}`);
    if (propertyDetails.balcony) structure.push(`🌇 _Balconies:_ ${propertyDetails.balcony}`);
    if (propertyDetails.parking) structure.push(`🚗 _Parking:_ ${propertyDetails.parking}`);
    if (propertyDetails.age_of_building) {
      const age = isNaN(propertyDetails.age_of_building) 
        ? propertyDetails.age_of_building 
        : `${propertyDetails.age_of_building} years`;
      structure.push(`🏗️ _Building Age:_ ${age}`);
    }
    buildSection('Building Specifications', structure);
  
    // Location & Amenities
    const location = [];
    if (propertyDetails.address) {
      location.push(`📍 *Address:*\n${propertyDetails.address.replace(/,/g, ',\n')}`);
    }
    if (propertyDetails.other_amentities) {
      const amenities = Array.isArray(propertyDetails.other_amentities)
        ? propertyDetails.other_amentities.join('\n• ')
        : propertyDetails.other_amentities;
      location.push(`\n✅ *Key Amenities:*\n• ${amenities}`);
    }
    buildSection('Location Features', location);
  
    // Final cleanup and formatting
    if (output.length > 0) {
      // Remove last separator line
      output.pop();
      // Add footer
      output.push('\n_ℹ️ Contact agent for more details_');
    }
  
    return output.length > 0 ? output : ['*No property details available*'];
}

export async function handleCustomNode(customCode, userSession) {
    if(customCode == 1){
        const message = userSession?.api?.POST?.text_product
        await handleTextOrdersForDrishtee(message, userSession)
    }
    else if(customCode == 2){
        console.log("Custom code 2 ")
        const mediaID = userSession?.api?.POST?.audio_product
        await handleAudioOrdersForDrishtee(mediaID, userSession)
    }
    else if (customCode == 3) {
        return realtorWebhook(userSession)
    }
    
}

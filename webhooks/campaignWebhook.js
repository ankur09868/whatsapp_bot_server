import { getMediaID } from "../helpers/handle-media.js";
import { replacePlaceholders } from "../helpers/misc.js";
import { messageCache } from "../server.js";
import axios from "axios";
import { writeFile, readFile } from 'fs/promises';
import { getCampaignUserSession, setCampaignUserSession, deleteCampaignUserSession } from "../queues/workerQueues.js";


// const campaigns = [
//     {
//         "id": 1,
//         "name": "first_campaign",
//         "bpid": 506766522524506,
//         "access_token": "EAAPev2DrAvYBO7bQHKCZBVtGfXP9ZAhr03piaOEVnzQAtLCqlu8GPrZCtVWWOKinV4ymSZBtZCS71vcqEkjgZCFjK2RxvVTBB2dpoW2oGYyugrq5MOrA9CVSsNuV7UeY0Q91JZASpux9atPffzRepSi16ajl38rjtsMOSmH0ZCxEsZBX0M5ZBuMEyyxfPfUFXw9BDI",
//         "account_id": 502195886316412,
//         "tenant": "ai",
//         "contacts": [919548265904],
//         "templates_data": [
//             {
//                 "index": 1,
//                 "name": "hello_world",
//                 "timeDelay": 5,
//                 "status": "read",
//                 "next": 2
//             },
//             {
//                 "index": 2,
//                 "name": "fav_artist_2",
//                 "timeDelay": 5,
//                 "status": "read",
//                 "next": 3
//             },
//             {
//                 "index": 3,
//                 "name": "hello_world",
//                 "timeDelay": 5,
//                 "status": "read",
//                 "next":4
//             },
//             {
//                 "index": 4,
//                 "name":"fav_artist_2",
//                 "terminal": true
//             }
//         ],
//         "init": 1
//     },
//     {
//         "id": 2,
//         "name": "second_campaign",
//         "bpid": 506766522524506,
//         "access_token": "EAAPev2DrAvYBO7bQHKCZBVtGfXP9ZAhr03piaOEVnzQAtLCqlu8GPrZCtVWWOKinV4ymSZBtZCS71vcqEkjgZCFjK2RxvVTBB2dpoW2oGYyugrq5MOrA9CVSsNuV7UeY0Q91JZASpux9atPffzRepSi16ajl38rjtsMOSmH0ZCxEsZBX0M5ZBuMEyyxfPfUFXw9BDI",
//         "account_id": 502195886316412,
//         "tenant": "ai",
//         "contacts": [919643393874],
//         "templates_data": [
//             {
//                 "index": 1,
//                 "name": "hello_world",
//                 "timeDelay": 30,
//                 "status": "read",
//                 "next": 2
//             },
//             {
//                 "index": 2,
//                 "name":"fav_artist_2",
//                 "terminal": true
//             }
//         ],
//         "init": 1
//     }
// ]

export async function campaignWebhook(req, res, campaignData){
    const bpid = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;


    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];
    if(statuses){

        const receivedMessageId = statuses.id
        const receivedMessageStatus = statuses.status
        const phone = statuses.recipient_id
        const key = `${bpid}_${phone}`

        const userSession = await getCampaignUserSession(key)
        console.log("User Sessssssssssssion: ", userSession)
        console.log("lst message id: ", userSession?.lastMessageID, "and received message id: ", receivedMessageId)
        console.log("expected message status: ", userSession?.templateInfo?.status, "receuved message status: ", receivedMessageStatus)
        if(userSession?.lastMessageID == receivedMessageId && userSession?.templateInfo?.status == receivedMessageStatus){
            
            await delay(userSession?.templateInfo?.timeDelay * 1000 || 0)
            sendDelayedTemplate(userSession?.templateInfo?.next , campaignData, key)
        }
        else{
            console.log("message id did not match")
        }
    }
}

async function sendDelayedTemplate(index, campaign, key) {
    const [bpid, recipient] = key.split('_')

    const templateInfo = campaign.templates_data.find(template => template.index === index)
    const response = await axios.get(
        `https://graph.facebook.com/v16.0/${campaign.account_id}/message_templates?name=${templateInfo.name}`,
        { headers: { Authorization: `Bearer ${campaign.access_token}` } }
    );
    const templateData = response.data.data[0]

    const messageData = await setTemplateData(templateData, recipient, campaign.bpid, campaign.access_token, campaign.tenant_id)
    const message_id = await sendMessage(recipient, campaign.bpid, messageData, campaign.access_token, campaign.tenant)
    
    if(templateInfo?.terminal) {
        deleteData(key)
        deleteCampaignUserSession(key)
    }
    else{
        const userSession = await getCampaignUserSession(key)

        userSession.templateInfo = templateInfo
        userSession.lastMessageID = message_id
        setCampaignUserSession(key, userSession)
    }
}

function delay(ms) {
    console.log(`Function call delayed for ${ms/1000} seconds`)
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function getSession(key) {
    const [bpid, phone] = key.split("_");
    let userSession = userSessions.get(key);
    if(!userSession){
        userSession = {
            bpid: bpid,
            phone: phone,
            templateInfo: null,
            lastMessageID: null
        }
        userSessions.set(key, userSession)
    }
    return userSession
}



async function setTemplateData(templateData, phone, bpid, access_token, tenant) {
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
                let modified_text = await replacePlaceholders(text, undefined, phone, tenant);
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
                let modified_text= await replacePlaceholders(text, undefined, phone, tenant);

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
                    else modified_text = await replacePlaceholders(text, undefined, phone, tenant);
        
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

async function sendMessage(phoneNumber, bpid, messageData, access_token) {
    try{
        // console.log("Sending Message Data: ", JSON.stringify(messageData, null,4))
        const url = `https://graph.facebook.com/v18.0/${bpid}/messages`;
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
        const messageID = response.data?.messages[0].id
        // console.log("Response: ", JSON.stringify(response.data, null, 3))
        return messageID;
    }catch(e){
        console.log("Error in sendMessage: ", e)
    }
}

const filePath = "./dataStore/activeCampaign.json";

export async function readData() {
    try {
        const data = await readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading the file:', err);
        return {};
    }
}

async function writeData(data) {
    try {
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        // console.log('Data successfully written to file');
    } catch (err) {
        console.error('Error writing to the file:', err);
    }
}

async function addData(key, value) {
    try {
        const data = await readData();
        data[key] = value;
        await writeData(data);
        // console.log(`Data added successfully for key: ${key}`);
    } catch (err) {
        console.error('Error adding data:', err);
    }
}

async function deleteData(key) {
    try {
        const data = await readData();
        if (data[key]) {
            delete data[key];
            await writeData(data);
            // console.log(`Data deleted for key: ${key}`);
        } else {
            console.log(`Key not found: ${key}`);
        }
    } catch (err) {
        console.error('Error deleting data:', err);
    }
}

async function sendTemplate(index, campaign) {
    const templateInfo = campaign.templates_data.find(template => template.index === index);
    const response = await axios.get(
        `https://graph.facebook.com/v16.0/${campaign.account_id}/message_templates?name=${templateInfo.name}`,
        { headers: { Authorization: `Bearer ${campaign.access_token}` } }
    );
    const templateData = response.data.data[0];

    const jobData = {campaign, templateData, templateInfo}

    for (const contact of campaign.contacts) {
        const key = `${campaign.bpid}_${contact}`;
        const userSession = await getSession(key);
        const messageData = await setTemplateData(templateData, contact, campaign.bpid, campaign.access_token);
        const message_id = await sendMessage(contact, campaign.bpid, messageData, campaign.access_token, campaign.tenant);

        userSession.templateInfo = templateInfo;
        userSession.lastMessageID = message_id;
        userSessions[key] = userSession;

        await addData(key, campaign.id);
    }
}

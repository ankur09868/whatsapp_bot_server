import express from "express";
import axios from "axios";
import NodeCache from 'node-cache';
import cors from 'cors';
import session from "express-session";
import crypto from "crypto";
import dotenv from "dotenv"
import { createServer } from "http";
import { Server } from "socket.io";

import { decryptRequest, encryptResponse, FlowEndpointException } from "./flowsAPI/encryption.js";
import { getNextScreen } from "./flowsAPI/flow.js";
import { getMediaID } from "./helpers/handle-media.js";
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister, addKey } from "./helpers/login-flow.js";
import { sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, fastURL, djangoURL} from "./snm.js"
import { updateStatus, updateLastSeen, getIndianCurrentTime, replacePlaceholders } from "./helpers/misc.js"
import { Worker } from "worker_threads"
import { messageQueue } from "./queues/workerQueues.js";
import { nuren_users } from "./helpers/order.js"; 
import { businessWebhook } from "./webhooks/businessWebhook.js";
import { userWebhook } from "./webhooks/userWebhook.js";
import { campaignWebhook } from "./webhooks/campaignWebhook.js";
import { readData } from "./queues/worker.js"
import { financeBotWebhook } from "./webhooks/financeBotWebhook.js"
import { testWebhook } from "./webhooks/manualWebhook.js";


export const messageCache = new NodeCache({ stdTTL: 600 });
dotenv.config()
const WEBHOOK_VERIFY_TOKEN = "COOL";
const PORT = 8080;
const app = express();
const httpServer = createServer(app);
const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'];

export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'],
    methods: ['GET', 'POST']
  }
});

export let userSessions = new Map();
export const nurenConsumerMap = {}

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});


app.use(
  express.json({
    // store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);

app.use(cors());

app.use((req, res, next) => {
    const origin = req.headers.origin;
  
    if (typeof origin === 'string' && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      return res.status(204).end();
    }
    
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    
    next();
});

app.use(session({
  secret: 'my_whatsapp_nuren_adarsh',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }  // Set to true if you're using HTTPS
}));

app.post("/sendMessage", async (req, res) => {
  const { message, phone } = req.body;
  const business_phone_number_id = 534896646366826;
  const access_token = "EAAVZBobCt7AcBO1IxLG4luufAySUGczTQZAeGZBZBDsGRLQZAaLJSVVCfTDJ1Eq23V7WhS6PVYZBCr9AHatrUyyFLuUDMXMLm2q2Oed2F9LAfsozZAVDvUvmBJNgGH8YVjpbOFTHVJjvZAQ2RY6aliQqpAP3XvrhxLm2tFJx8eobUxpX8njE1V2BmWhxwMmqfwfdjTqWJlFfdzR7qqkAZCv6HmQqYZASW1xkplAePvGYdJinL0Ibh5FvSFYfxkUyqR";
  const tenant_id = 'leqcjsk';

  try {
    await sendTextMessage(phone, business_phone_number_id, message, access_token, tenant_id);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumbers, message, url, messageType, additionalData, business_phone_number_id, bg_id } = req.body;
    const tenant_id = req.headers['x-tenant-id'];
    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      
      const formattedPhoneNumber = phoneNumber.length === 10 ? `91${phoneNumber}` : phoneNumber;
      const cacheKey = `${business_phone_number_id}`;
      
      let access_token = messageCache.get(cacheKey);
      if (!access_token) {
        try {
          const tenantRes = await axios.get(`${fastURL}/whatsapp_tenant/`, {
            headers: { 'X-Tenant-Id': tenant_id }
          });
          access_token = tenantRes.data.whatsapp_data[0].access_token;
          messageCache.set(cacheKey, access_token);
        } catch (error) {
          console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
          throw error;
        }
      }

      const messageHandlers = {
        text: () => sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token, tenant_id),
        image: () => {
          const { imageId, caption } = additionalData;
          console.log(`image ID: ${imageId}, caption: ${caption}`);
          return sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageId, caption, access_token, tenant_id);
        },
        audio: () => {
          const { audioID } = additionalData;
          return sendAudioMessage(formattedPhoneNumber, business_phone_number_id, audioID, access_token, tenant_id);
        },
        video: () => {
          const { videoID } = additionalData;
          return sendVideoMessage(formattedPhoneNumber, business_phone_number_id, videoID, access_token, tenant_id);
        },
        location: () => sendLocationMessage(formattedPhoneNumber, business_phone_number_id, additionalData, access_token, tenant_id)
      };

      if (!messageHandlers[messageType]) {
        throw new Error("Invalid message type");
      }

      const response = await messageHandlers[messageType]();
      const messageID = response.data?.messages[0]?.id;

      return { phoneNumber: formattedPhoneNumber, messageID, success: true };
    });

    const results = await Promise.all(sendPromises);
    res.json({ results });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.post("/use-worker", async (req, res) => {
  const worker = new Worker('./worker2.js', {workerData: req.body});
worker.on('message', (result) => {
console.log('square of 5 is :', result);
})
worker.on("error", (msg) => {
    console.log(msg);
 });
console.log('hurreyy')
})


export async function setTemplate(templateData, phone, bpid, access_token, tenant, otp, link) {
try {
    console.log("otp received: ", otp);
    console.log("Template Data rcvd: ", templateData)
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
            let modified_text;
            if (otp) modified_text = otp;
            else modified_text = await replacePlaceholders(text, undefined, phone, tenant);

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
        } else if (component.type === "CAROUSEL") {
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
        } else if(component.type == "BUTTONS"){
          if(tenant == 'qqeeusz' && link){
            const parameters = [{type: "text", text: link}]
            const button_component = {type: "button", sub_type: "url", index: 0, parameters: parameters}
            console.log("Button Component: ", button_component)

            res_components.push(button_component)
          }
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

async function sendCampaign(campaignData, access_token, tenant_id, account_id, bpid){
  console.log("Req rcvd in sendCampaign: ", campaignData, access_token, account_id, tenant_id, bpid)

  const campaignId = campaignData.id
  const response = await axios.get(`${djangoURL}/campaign?id=${campaignId}`, {headers: {'X-Tenant-Id': tenant_id}})

  const contacts = response.data.phone
  const name = response.data.name
  const init = response.data.init
  const templates_data = response.data.templates_data
  console.log("templates data, init: " , templates_data, init)

  const templateInfo = templates_data.find(template => template.index == init)
  campaignData = { campaignId, name, contacts, templates_data, init}
  console.log("TEmplate Info: ", templateInfo, campaignData)

  const templateName = templateInfo.name;
  const cacheKey = `${account_id}_${templateName}`;
  let templateData = messageCache.get(cacheKey);
  console.log("AccountID, templateName, access_token: ", account_id, templateName, access_token)
  
  if (!templateData) {
    const response = await axios.get(
      `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
      {headers: { Authorization: `Bearer ${access_token}` }}
    );
    console.log("REsponse: ", response.data)
    templateData = response.data.data[0]
    messageCache.set(cacheKey, templateData);
  }

  for(let contact of contacts){
    const messageData = await setTemplate(templateData, contact, bpid, access_token, tenant_id, null)
    campaignData = {
      ...campaignData, access_token, tenant_id, account_id, bpid
    }
    console.log("Sending data in campainn worker")
    messageQueue.add('campaign', {messageData, contact, templateInfo, campaignData}, {attempts: 3, backoff: 5000});
  }
  console.log("Contacts: ", contacts)
  const data = {name: campaignData.name, sent: contacts.length, type: "campaign"}
  axios.post(`${djangoURL}/message-stat/`, data, {headers: {'X-Tenant-Id': campaignData.tenant_id}})
}

async function sendTemplate(templateData, access_token, tenant_id, account_id, bpid) {
  console.log("Req rcvd in sendTemplate: ", templateData, access_token, account_id, tenant_id, bpid);

  const templateName = templateData.name;
  const cacheKey = `${account_id}_${templateName}`;
  let templateDetails = messageCache.get(cacheKey);

  console.log("AccountID, templateName, access_token: ", account_id, templateName, access_token);
  if (!templateDetails) {
    const response = await axios.get(
      `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    console.log("Response: ", response.data);
    templateDetails = response.data.data[0];
    messageCache.set(cacheKey, templateDetails);
  }

  const contacts = templateData.phone

  console.log("Contacts to send template: ", contacts);

  for (let contact of contacts) {
    const messageData = await setTemplate(templateDetails, contact, bpid, access_token, tenant_id, null);
    const templateData = {
      name: templateName,
      access_token,
      tenant_id,
      account_id,
      bpid
    };
    console.log("Sending data in template worker");
    messageQueue.add('template', { messageData, contact, templateData }, { attempts: 3, backoff: 5000 });
  }

  console.log("Contacts: ", contacts);
  const data = { name: templateName, sent: contacts.length, type: "template" };
  axios.post(`${djangoURL}/message-stat/`, data, { headers: { 'X-Tenant-Id': tenant_id } });
}

async function sendTemplateToGroup(groupData, access_token, tenant_id, account_id, bpid) {
  console.log("Req rcvd in sendTemplateToGroup: ", groupData, access_token, account_id, tenant_id, bpid);

  const groupId = groupData.id;
  const groupName = groupData.name;
  const templateName = groupData.templateName
  const response = await axios.get(`${fastURL}/broadcast-groups/${groupId}`, { headers: { 'X-Tenant-Id': tenant_id } });
  const groupDetails = response.data;
  const contacts = groupDetails.members.map(member => member.phone);
  
  console.log("Group details: ", groupDetails);
  console.log("Contacts to send template to group: ", contacts);

  // Fetch the template details from the Facebook API (if not already cached)
  const cacheKey = `${account_id}_${templateName}`;
  let templateDetails = messageCache.get(cacheKey);

  console.log("AccountID, templateName, access_token: ", account_id, templateName, access_token);
  if (!templateDetails) {
    const response = await axios.get(
      `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    console.log("Response: ", response.data);
    templateDetails = response.data.data[0];
    messageCache.set(cacheKey, templateDetails);
  }

  // Loop through each contact and send the template
  for (let contact of contacts) {
    const messageData = await setTemplate(templateDetails, contact, bpid, access_token, tenant_id, null);
    groupData = {
      ...groupData,
      templateName,
      access_token,
      tenant_id,
      account_id,
      bpid
    };
    console.log("Sending data in worker for group");
    messageQueue.add('group', { messageData, contact, groupData }, { attempts: 3, backoff: 5000 });
  }

  console.log("Contacts: ", contacts);
  const data = { name: groupName, sent: contacts.length, type: "group" };
  await axios.post(`${djangoURL}/message-stat/`, data, { headers: { 'X-Tenant-Id': tenant_id } });
}

app.post("/send-template", async (req, res) => {
  const type = req.body.type;
  const bpid = req.headers['business_phone_number_id'];

  try {
    let responseData = messageCache.get(bpid);
    if (!responseData) {
      const response = await axios.get(`${fastURL}/whatsapp_tenant/`, {
        headers: { 'bpid': bpid }
      });
      responseData = response.data; 
      messageCache.set(bpid, responseData);
    }

    const whatsappData = responseData.whatsapp_data?.[0];
    if (!whatsappData) {
      return res.status(400).send({ status: 400, message: "Invalid WhatsApp data." });
    }

    const { access_token, tenant_id, business_account_id: account_id } = whatsappData;

    const handleType = {
      campaign: () => {
        const campaignData = req.body?.campaign;
        if (!campaignData) {
          return res.status(400).send({ status: 400, message: "Campaign data not found in request" });
        }
        sendCampaign(campaignData, access_token, tenant_id, account_id, bpid);
        return res.sendStatus(200);
      },
      template: () => {
        const templateData = req.body?.template;
        if (!templateData) {
          return res.status(400).send({ status: 400, message: "Template data not found in request" });
        }
        sendTemplate(templateData, access_token, tenant_id, account_id, bpid);
        return res.sendStatus(200);
      },
      group: () => {
        const groupData = req.body?.group;
        if (!groupData) {
          return res.status(400).send({ status: 400, message: "Group data not found in request" });
        }
        sendTemplateToGroup(groupData, access_token, tenant_id, account_id, bpid);
        return res.sendStatus(200);
      }
    };

    if (handleType[type]) {
      return handleType[type]();
    } else {
      return res.status(400).send({ status: 400, message: "Invalid type specified in request" });
    }
  } catch (error) {
    console.error("Error in /send-template:", error.message);
    res.status(500).send({ status: 500, message: "Internal server error" });
  }
});

app.post("/reset-session", async (req, res) => {
  const bpid = req.body.business_phone_number_id;
  try {
    for (let key of userSessions.keys()) {
      if (key.includes(bpid)) {
        userSessions.delete(key);
        messageCache.del(bpid);
      }
    }
    console.log("User Sessions after delete: ", userSessions, messageCache)
    // console.log("Message Cache after delete: ", messageCache)
    res.status(200).json({ "Success": `Session Deleted Successfully for ${bpid}` });

  } catch (error) {
    console.log(`Error Occurred while resetting session for ${bpid}: `, error);

    res.status(500).json({ "Error": `Error Occurred while resetting session for ${bpid}` });
  }
});

export const customWebhook = new Map()

async function convertToValidDateFormat(dateString) {
  // Check if the input matches the format "DD/MM/YYYY, HH:MM:SS.MS"
  const regex = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
  const match = dateString.match(regex);

  if (!match) {
    throw new Error("Invalid date format");
  }

  // Extract components from the matched regex
  const day = match[1];
  const month = match[2];
  const year = match[3];
  const hour = match[4];
  const minute = match[5];
  const second = match[6];
  const millisecond = match[7];

  // Construct a new formatted date string in "YYYY-MM-DD HH:MM:SS.MMMMMM" format
  const formattedDate = `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond.padEnd(6, '0')}`;

  return formattedDate;
}

app.post("/webhook", async (req, res) => {
  try {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];

    if (message) {
      // return testWebhook(req, res)
      const userPhoneNumber = contact?.wa_id || null;
      const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)

      const key = `${business_phone_number_id}_${userPhoneNumber}`


      if(Object.values(nuren_users).includes(userPhoneNumber)) return businessWebhook(req,res)
      else return userWebhook(req, res )
      
    }

    if (statuses) {
      let timestamp = await getIndianCurrentTime()
      const convertedTimestamp = await convertToValidDateFormat(timestamp)
      const status = statuses?.status
      const id = statuses?.id
      const userPhone = statuses?.recipient_id
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

      if (status == "failed"){
        // updateStatus(status, id, null, null, null, null, timestamp)
        axios.post(`${djangoURL}/individual_message_statistics/`, {message_id: id, status, timestamp: convertedTimestamp}, { headers: { 'bpid': business_phone_number_id } })
        const error = statuses?.errors[0]
        console.log("Message failed: ", error)
        io.emit('failed-response', error)
        // res.status(400).json(error)
      }
      else if(status == "delivered"){
        // updateStatus(status, id, null, null, null, null, timestamp)
        axios.post(`${djangoURL}/individual_message_statistics/`, {message_id: id, status, timestamp: convertedTimestamp}, { headers: { 'bpid': business_phone_number_id } })
        console.log("Delivered: ", userPhone)
        updateLastSeen("delivered", timestamp, userPhone, business_phone_number_id)
      }
      else if(status == "read"){
        // updateStatus(status, id, null, null, null, null, timestamp)
        axios.post(`${djangoURL}/individual_message_statistics/`, {message_id: id, status, timestamp: convertedTimestamp}, { headers: { 'bpid': business_phone_number_id } })
        updateLastSeen("seen", timestamp, userPhone, business_phone_number_id)
      }

      const activeCampaign = await readData()
      // console.log("Active Campaign: ",typeof activeCampaign, activeCampaign)
      const key = `${business_phone_number_id}_${userPhone}`
      if(key in activeCampaign) {
        // console.log("bpid is in campaign")
        return campaignWebhook(req, res, activeCampaign[key])
      }
    }
    console.log("Webhook Processing Complete")
    res.sendStatus(200)
  }
  catch (error) {
    console.error("Error in webhook handler:", error);
    res.sendStatus(500);
  }
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("received req: ", req.body)
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    res.sendStatus(403);
  }
});
  
app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.
  Checkout README.md to start.</pre>`);
});

app.post("/login-flow/:tenant_id", async (req, res) => {
  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const tenant_id = req.params.tenant_id;
    console.log("Tenant ID: ", tenant_id)
    const authCode = req.body.code;
    console.log("authCode: ", authCode)


    const access_token = await getAccessToken(authCode);
    console.log("access token: ", access_token);


    const waba_id = await getWabaID(access_token)
    console.log("waba_id: ", waba_id);

    const business_phone_number_id = await getPhoneNumberID(access_token, waba_id);
    console.log("bipd: ", business_phone_number_id)


    await delay(5000);

    
    const register_response = await registerAccount(business_phone_number_id, access_token)


    const postRegister_response = await postRegister(access_token, waba_id)
    
    const response = axios.post(`${djangoURL}/insert-data/`, {
      business_phone_number_id : business_phone_number_id,
      access_token : access_token,
      accountID : waba_id,
      firstInsert : true
    },
    {
      headers: {
        'X-Tenant-Id': tenant_id
      }
    });

    addKey(tenant_id)
    
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send('Error occurred during login flow');
  }
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

function clearInactiveSessions() {
  const inactivityThreshold = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  for (const [userPhoneNumber, session] of userSessions.entries()) {
    if (now - session.lastActivityTime > inactivityThreshold) {
      userSessions.delete(userPhoneNumber);
    }
  }
}

setInterval(clearInactiveSessions, 60 * 60 * 1000);

const { APP_SECRET, PASSPHRASE } = process.env
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n')

app.post("/data", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your env variable "PRIVATE_KEY".'
    );
  }
  if(!isRequestSignatureValid(req)) {
    // Return status code 432 if request signature does not match.
    // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
    return res.status(432).send();
  }
  let decryptedRequest = null;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error(err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }
  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  // TODO: Uncomment this block and add your flow token validation logic.
  // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
  // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

  /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", screenResponse);

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
});

function isRequestSignatureValid(req) {
  if(!APP_SECRET) {
    console.warn("App Secret is not set up. Please Add your app secret in /.env file to check for request validation");
    return true;
  }
  const signatureHeader = req.get("x-hub-signature-256");
  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");
  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest('hex');
  const digestBuffer = Buffer.from(digestString, "utf-8");
  if ( !crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match");
    return false;
  }
  return true;
}

app.post("/verify-payment", async (req, res) => {
  // console.log(req)
  console.log("Recieved body: ", JSON.stringify(req.body, null, 7))
  res.sendStatus(200)
});

app.post("/start-campaign", async(req,res) => {
  
  console.log("Recieved body: ", JSON.stringify(req.body, null, 7))
  startCampaign(req.body.campaign_id)
  res.sendStatus(200)
})

// req.body = {
//   "type": "campaign" || "template" || "group",
//   "template": {
//     "name": `${template_name}`,
//     "contacts": `${contact_list}`
//   },
//   "campaign": {
//     "id": `${campaign_id}`,
//     "name": `${campaign_name}` || null,
//     "contacts": `${contact_list}` || null,
//     "templateName": `${template_name}` ||  null //first template's name
//     "templateIndex": `${template_index}` || null //first template's index
//   },
//   "group": {
//     "id": `${group_id}`,
//     "name": `${group_name}` || null,
//     "templateName": `${template_name}`,
//     "contacts": `${contact_list}` || null
//   }
// }
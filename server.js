import express from "express";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import dotenv from 'dotenv';
import session from "express-session";
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { sendNodeMessage, sendImageMessage, sendButtonMessage, sendTextMessage, sendMessage, replacePlaceholders, addDynamicModelInstance, sendAudioMessage, sendVideoMessage,sendLocationMessage, baseURL } from "./snm.js";
import NodeCache from 'node-cache';

import FormData from "form-data";
const messageCache = new NodeCache({ stdTTL: 600 });

const AIMode=false;
const WEBHOOK_VERIFY_TOKEN = "COOL";
const PORT = 8080;
const app = express();
const httpServer = createServer(app);
const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://whatsapp.nuren.ai/'];

export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://whatsapp.nuren.ai/'],
    methods: ['GET', 'POST']
  }
});

export let userSessions = new Map();

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});

export async function updateStatus(status, message_id, business_phone_number_id, user_phone, broadcastGroup_id) {
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
    }else if (status === "read") {
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
      bg_id : broadcastGroup_id
    };
    
    // console.log("Sending request with data:", data);

    // Send POST request with JSON payload
    const response = await axios.post(`${baseURL}/set-status/`, data, {
      headers: { 
        "X-Tenant-Id": "ll", 
        "Content-Type": "application/json" 
      }
    });

    console.log("Response received:", response.data);
  } catch (error) {
    console.error("Error updating status:", error.response ? error.response.data : error.message);
  }
}

async function sendTemplates(template){
  const templateData = {
    type: "template",
    template: template
  }
  return templateData
}

async function validateInput(inputVariable, message){
  try{
  const prompt = `Question being asked is: ${inputVariable}?\n
  Response being given is: ${message}\n
  Does the response answer the question? reply in yes or no. nothing else `

  const api_key = process.env.OPENAI_API_KEY;

  const data = {
    model: "gpt-4o-mini",
    messages : [
      {
        role: "system",
        content: "you are a helpful assisstant who replies in yes or no only"
      },
      {
        role: "user",
        content: prompt
      }
    ]
  }
  const response = await axios.post('https://api.openai.com/v1/chat/completions',data, {
    headers: {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json',
    }
  });

  const validationResult = response.data.choices[0].message.content;
  console.log("Validation Result: ", validationResult)
  return validationResult
} catch (error) {
  console.error('Error validating input:', error);
  return false;
}
}


app.use(express.json());
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

app.get("/imageData/:bpid/:id", async (req, res) => {
  try {
    const imageID = req.params.id;  
    const bpid = req.params.bpid;
    if (!imageID) {
      return res.status(400).send("Image ID is required");
    }
    let access_token;
      
    try {
      const tenantRes = await axios.get(`${baseURL}/whatsapp_tenant?business_phone_id=${bpid}`, {
        headers: { 'X-Tenant-Id': 'll' }
      });
      access_token = tenantRes.data.access_token;
    } catch (error) {
      console.error(`Error fetching tenant data for user ${bpid}:`, error);
      throw error;
    }
    let result = await getImageAndUploadToBlob(imageID, access_token)
    console.log("blob url: ", result)
    res.json(result)
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/flowdata", async (req, res) => {
  adjList=req.body.adjacencyList;
  flow=req.body.nodes;
  console.log("rec data: ", req.body);


  res.status(200).json({ success: true, message: "flowdata sent successfully" });
})

app.patch("/toggleAiReplies", async(req,res) =>{
  try {
    AI_Replies = !AI_Replies;
    res.status(200).json({ success: true, message: "Task Done" });
  } catch (error) {
    console.error("Error sending Whatsapp message:", error.message);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumbers, message, url, messageType, additionalData, business_phone_number_id, bg_id } = req.body;
    var tenant_id = req.headers['X-Tenant-Id'];

    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      const formattedPhoneNumber = `91${phoneNumber}`;
      const cacheKey = `${business_phone_number_id}_${tenant_id}`;
      
      let access_token = messageCache.get(cacheKey);
      if (!access_token) {
        try {
          const tenantRes = await axios.get(`${baseURL}/whatsapp_tenant?business_phone_id=${business_phone_number_id}`, {
            headers: { 'X-Tenant-Id': 'll' }
          });
          access_token = tenantRes.data.access_token;
          messageCache.set(cacheKey, access_token);
        } catch (error) {
          console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
          throw error;
        }
      }

      let formattedConversation = [{ text: message, sender: "bot" }];
      const saveConversationPromise = fetch(`${baseURL}/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': 'll'
        },
        body: JSON.stringify({
          contact_id: formattedPhoneNumber,
          business_phone_number_id: business_phone_number_id,
          conversations: formattedConversation,
          tenant: 'll',
        }),
      });

      let sendMessagePromise;
      let fr_flag;
      switch (messageType) {
        case 'text':

          sendMessagePromise = sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token, fr_flag = true);
          break;
        case 'image':
          const { imageId, caption } = additionalData;
          console.log(`image ID: ${imageId}, caption: ${caption}`)
          sendMessagePromise = sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageId, caption, access_token, fr_flag = true);
          formattedConversation.push({ text: caption, sender: "bot" });
          break;
        // case 'button':
        //   const { buttons } = additionalData;
        //   sendMessagePromise = sendButtonMessage(formattedPhoneNumber, business_phone_number_id, message, buttons, access_token);
        //   break;
        case 'audio':
          const { audioID } = additionalData;
          sendMessagePromise = sendAudioMessage(formattedPhoneNumber, business_phone_number_id, audioID, access_token, fr_flag = true);
          break;
        case 'video':
          const { videoID } = additionalData;
          sendMessagePromise = sendVideoMessage(formattedPhoneNumber, business_phone_number_id, videoID, access_token, fr_flag = true);
          break;
        case 'location':
          sendMessagePromise = sendLocationMessage(formattedPhoneNumber, business_phone_number_id, additionalData, access_token, fr_flag = true);
          break;
        default:
          throw new Error("Invalid message type");
      }

      const [saveRes, response] = await Promise.all([saveConversationPromise, sendMessagePromise]);

      if (!saveRes.ok) {
        console.error("Error saving conversation:", await saveRes.text());
      }

      const messageID = response.data?.messages[0]?.id;
      if (bg_id != null && messageID) {
        updateStatus(null, messageID, null, null, bg_id).catch(console.error);
      }

      return { phoneNumber: formattedPhoneNumber, messageID, success: true };
    });

    const results = await Promise.all(sendPromises);
    res.status(200).json({ success: true, message: "WhatsApp message(s) sent successfully", results });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message" });
  }
});


async function getMediaID(handle, bpid, access_token) {
  const imageResponse = await axios.get(handle, { responseType: 'arraybuffer' });
  
  const formData = new FormData();
  formData.append('file', Buffer.from(imageResponse.data), 'image.jpeg');
  formData.append('type', 'image/jpeg');
  formData.append('messaging_product', 'whatsapp');

  const response = await axios.post(
    `https://graph.facebook.com/v20.0/${bpid}/media`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        ...formData.getHeaders() 
      }
    }
  );
  
  console.log(response.data);
  return response.data.id;
}


async function setTemplate(templateData, phone, bpid, access_token) {
  try {
    const components = templateData?.components;
    const template_name = templateData.name;
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
          let modified_text = await replacePlaceholders(text, null, phone, bpid)

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

    const messageData = {
      type: "template",
      template: {
        name: template_name,
        language: {
          code: "en_US"
        },
        components: res_components
      }
    };

    return messageData;
  } catch (error) {
    console.error("Error in setTemplate function:", error);
    throw error; // Rethrow the error to handle it further up the call stack if needed
  }
}

app.post("/send-template", async(req, res) => {
  const { bg_id, template, business_phone_number_id, phoneNumbers } = req.body
  const tenant_id = req.headers['X-Tenant-Id'];
  
  const name = template.name
  console.log(`tenant ID: ${tenant_id}, name: ${name}`)
  try {
    const tenantRes = await axios.get(`${baseURL}/whatsapp_tenant?business_phone_id=${business_phone_number_id}`, {
      headers: { 'X-Tenant-Id': tenant_id }
    });
    const access_token = tenantRes.data.access_token;
    const account_id = tenantRes.data.account_id;
    console.log(`access token: ${access_token}, account ID: ${account_id}`)
    
    const response  = await axios.get(`https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${name}`, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    })
    const templateData = response.data.data[0]
    console.log(`result: ${JSON.stringify(response.data, null, 3)}, template data: ${JSON.stringify(templateData, null, 3)}`)
    
    // console.log(`message data: ${JSON.stringify(messageData, null, 3)}`)

    for (const phoneNumber of phoneNumbers) {
      try {
        const formattedPhoneNumber = `${phoneNumber}`;

        const messageData = await setTemplate(templateData, phoneNumber, business_phone_number_id, access_token)

        const sendMessage_response = await sendMessage(formattedPhoneNumber, business_phone_number_id, messageData, access_token);
        
        const messageID = sendMessage_response.data?.messages[0]?.id;
        if (bg_id != null) {
          updateStatus(null, messageID, null, null, bg_id);
        }

        // Save conversation to backend
        const formattedConversation = [{ text: template.name, sender: "bot" }];
        const saveRes = await fetch(`${baseURL}/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': tenant_id 
          },
          body: JSON.stringify({
            contact_id: formattedPhoneNumber,
            business_phone_number_id: business_phone_number_id,
            conversations: formattedConversation,
            tenant: tenant_id ,
          }),
        });
        // if (!saveRes.ok) throw new Error("Failed to save conversation");
      } catch (error) {
        console.error(`Failed to send message to ${phoneNumber}:`, error);
      }
    }

    res.status(200).json({ success: true, message: "WhatsApp message(s) sent successfully"});
  } catch (error) {
    console.error("Error sending WhatsApp message::::", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message" });
  }
});

async function executeFallback(userSession){
  console.log("Entering Fallback")
  var fallback_count = userSession.fallback_count
  const userPhoneNumber = userSession.userPhoneNumber
  const business_phone_number_id = userSession.business_number_id
  if(fallback_count > 0){
    console.log("Fallback Count: ", fallback_count)
    const fallback_msg = userSession.fallback_msg
    const access_token = userSession.accessToken
    const response = await sendTextMessage(userPhoneNumber, business_phone_number_id, fallback_msg, access_token)
    fallback_count=fallback_count - 1;
    userSession.fallback_count = fallback_count
  }
  else{
    userSessions.delete(userPhoneNumber+business_phone_number_id)
    console.log("restarting user session for user: ", userPhoneNumber)
    }
}

async function addContact(business_phone_number_id, c_data) {
  const data = {
    bpid: business_phone_number_id
  }
  try{
    const response = await axios.post(`${baseURL}/get-tenant/`, data, {
      headers: {'X-Tenant-Id': 'll', 'Content-Type': 'application/json'}
    })

    const tenant = response.data.tenant

    await axios.post(`${baseURL}/contacts_by_tenant/`, c_data, {
      headers: {'X-Tenant-Id': tenant}
    })
  }catch (error){
    console.error('Error Occured: ', error.message)
  }
}

app.post("/reset-session", async (req, res) => {
  try {
    const bpid = req.body.business_phone_number_id;
    for (let key of userSessions.keys()) {
      if (key.includes(bpid)) {
        userSessions.delete(key);
      }
    }
    console.log("User Sessions after delete: ", userSessions)
    res.status(200).json({ "Success": `Session Deleted Successfully for ${bpid}` });

  } catch (error) {
    console.log(`Error Occurred while resetting session for ${bpid}: `, error);

    res.status(500).json({ "Error": `Error Occurred while resetting session for ${bpid}` });
  }
});


app.post("/webhook", async (req, res) => {
  try {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;
    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];
    
    const name = contact?.profile?.name || null
    console.log("Contact: ", name)
    if(name && userPhoneNumber){
      const contact_data = {
        phone: userPhoneNumber,
        name: name
      }
      addContact(business_phone_number_id, contact_data)
    }

    if (message) {
      const repliedTo = message?.context?.id || null
      console.log("Extracted data:", {
        business_phone_number_id,
        contact,
        message,
        userPhoneNumber
      });
      if (repliedTo !== null) {
        console.log("updating status: ", repliedTo)
        updateStatus("replied", repliedTo)
      }
      console.log("Emitting new message event");
      
      let formattedConversation = [{
        text: message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null),
        sender: "user"
      }];
        
      const now = new Date();
      const timestamp = now.toLocaleString();
      try {
          fetch(`${baseURL}/whatsapp_convo_post/${userPhoneNumber}/?source=whatsapp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': 'll'
            },
            body: JSON.stringify({
              contact_id: userPhoneNumber,
              business_phone_number_id: business_phone_number_id,
              conversations: formattedConversation,
              tenant: 'll',
            }),
          });
          // if (!saveRes.ok) throw new Error("Failed to save conversation");
        } catch (error) {
          console.error("Error saving conversation:", error.message);
        }
        
        const messageData = {
          type: "text",
          text: { body: message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null) }
      }
      try{
      io.emit('new-message', {
        message: messageData,
        phone_number_id: business_phone_number_id,
        contactPhone: userPhoneNumber,
        time: timestamp
      });
      
      console.log("Emitted node message: ", messageData)
    }catch(error){
      console.log("error occured while emission: ", error)
    }
    const temp_user = message?.text?.body?.startsWith('*/') ? message.text.body.split('*/')[1]?.split(' ')[0] : null;
      if(temp_user){
        try{
          io.emit('temp-user', {
            temp_user: temp_user,
            phone_number_id: business_phone_number_id,
            contactPhone: userPhoneNumber,
            time: timestamp
          });
          
          console.log("Emitted temp_user message: ", messageData)
        }catch(error){
          console.log("error occured while emission of temp_user: ", error)
        }
      }
      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
      if (!userSession) {
        console.log(`Creating new session for user ${userPhoneNumber}`);
        try {
          const response = await axios.get(`${baseURL}/whatsapp_tenant?business_phone_id=${business_phone_number_id}`,{
            headers: {'X-Tenant-Id': 'll'} 
          });
          const flowData = response.data.flow_data
          const adjList = response.data.adj_list
          console.log("Tenant data received:", response.data);
  
          // Validate the data types
          if (!Array.isArray(flowData)) {
            throw new Error("flowData is not an array");
          }
          if (!Array.isArray(adjList) || !adjList.every(Array.isArray)) {
            throw new Error("adjList is not an array of arrays");
          }

          const startNode = response.data.start !== null ? response.data.start : 0;
          const currNode = startNode 
          userSession = { 
            flowData: response.data.flow_data,
            adjList: response.data.adj_list,
            accessToken: response.data.access_token,
            flowName : response.data.flow_name,
            startNode : startNode,
            currNode: currNode,
            nextNode: adjList[currNode],
            business_number_id: business_phone_number_id,
            userPhoneNumber : userPhoneNumber,
            inputVariable : null,
            inputVariableType: null,
            fallback_msg : response.data.fallback_msg || "please provide correct input",
            fallback_count: response.data.fallback_count != null ? response.data.fallback_count : 1
          };
          const key = userPhoneNumber + business_phone_number_id
          userSessions.set(key, userSession);
          // console.log(`New session created for user ${userPhoneNumber}:`, userSessions);
        } catch (error) {
          console.error(`Error fetching tenant data for user ${userPhoneNumber}:`, error);
          throw error;
        }
      } else {
        if(userSession.currNode != null) userSession.nextNode = userSession.adjList[userSession.currNode]
        else {
          userSession.currNode = userSession.startNode
          userSession.nextNode = userSession.adjList[userSession.currNode]
        }
        // console.log(`Existing session found for user ${userPhoneNumber}:`, userSession);
      }
      if (!AIMode) {
        let sendDynamicPromise;
        console.log("input vr: ", userSession.inputVariable)
        if (userSession.inputVariable !== undefined && userSession.inputVariable !== null && userSession.inputVariable.length > 0){
          console.log(`Input Variable: ${userSession.inputVariable}`);
          console.log(`Input Variable Type: ${userSession.inputVariableType}`);

          try{
            let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
          
            // var validateResponse = await validateInput(userSession.inputVariable, userSelection)
            //TODO: fallback condiiton
            var validateResponse = "Yes"
            if(validateResponse == "No." || validateResponse == "No"){
              await executeFallback(userSession)
              res.sendStatus(200)
              return
            }else{
              let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
          
              const updateData = {
                phone_no : userPhoneNumber,
                [userSession.inputVariable] : userSelection
              }
              userSession.inputVariable = null
              const modelName = userSession.flowName
              sendDynamicPromise = addDynamicModelInstance(modelName , updateData)

              console.log(`Updated model instance with data: ${JSON.stringify(updateData)}`);
              console.log(`Input Variable after update: ${userSession.inputVariable}`);
            }
          } catch (error) {
            console.error("An error occurred during processing:", error);
            if (!res.headersSent) {
              res.sendStatus(500); // Or any other error status code based on your use case
            }
          }
        }
        console.log("Processing in non-AI mode");
        if (message?.type === "interactive") {
          console.log("Processing interactive message");
          let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
          let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title;
          console.log("User selection:", { userSelectionID, userSelection });
          try {
            console.log("NextNode: ", userSession.nextNode)
            for (let i = 0; i < userSession.nextNode.length; i++) {
              console.log(`Checking node ${userSession.nextNode[i]}:`, userSession.flowData[userSession.nextNode[i]]);
              
              if (userSession.flowData[userSession.nextNode[i]].id == userSelectionID) {
                userSession.currNode = userSession.nextNode[i];
                console.log("Matched node found. New currNode:", userSession.currNode);
                userSession.nextNode = userSession.adjList[userSession.currNode];
                console.log("Updated nextNode:", userSession.nextNode);
                userSession.currNode = userSession.nextNode[0];
                console.log("Final currNode:", userSession.currNode);
                console.log("Calling sendNodeMessage");
                sendNodeMessage(userPhoneNumber,business_phone_number_id);
                break; // Exit the loop when the condition is met
              }
            };
          } catch (error) {
            console.error('Error processing interactive message:', error);
          }
        }
        else if (message?.type === "text") {
          console.log("Processing text message");
          console.log(userSession.currNode, userSession.startNode)
          const flow = userSession.flowData
          const type = flow[userSession.currNode].type
          if (userSession.currNode != userSession.startNode){
            if (['Text', 'string', 'audio', 'video', 'location', 'image'].includes(type)) {
            // console.log(`Storing input for node ${userSession.currNode}:`, message?.text?.body);
            //userSession.inputMap.set(userSession.currNode, message?.text?.body);
            userSession.currNode = userSession.nextNode[0];
            console.log("Updated currNode:", userSession.currNode);
            }
            else if(['Button', 'List'].includes(type)){
              await executeFallback(userSession)
              res.sendStatus(200)
              return
            }
          }

          console.log("Calling sendNodeMessage");
          sendNodeMessage(userPhoneNumber,business_phone_number_id);
        }

      } else {
        console.log("Processing in AI mode");
      }
      
      if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
        console.log("Processing media message:", message?.type);
        const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
        console.log("Media ID:", mediaID);
        let mediaURL;
  
        try {
          console.log("Fetching media URL");
          const response = await axios({
            method: "GET",
            url: `https://graph.facebook.com/v19.0/${mediaID}`,
            headers: {
              Authorization: `Bearer ${userSession.accessToken}`,
            },
          });
          mediaURL = response.data.url;
          console.log("Media URL obtained:", mediaURL);
        } catch (error) {
          console.error("Error fetching media URL:", error);
        }
  
        try {
          console.log("Retrieving media content");
          const response = await axios({
            method: "GET",
            url: mediaURL,
            headers: {
              Authorization: `Bearer ${userSession.accessToken}`,
            },
          });
          let document_file = response;
          console.log("Media content retrieved:", document_file);
          // TODO: Implement handleFileUpload
          // console.log("Uploading file");
          // handleFileUpload(document_file);
        } catch (error) {
          console.error("Error retrieving media content:", error);
        }
        console.log("Webhook processing completed successfully");
      }
    }
    if (statuses) {
      // console.log("Webhook received:", JSON.stringify(req.body, null, 2));
      const phoneNumber = statuses?.recipient_id
      const status = statuses?.status
      const id = statuses?.id
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
      
      updateStatus(status, id)
      console.log(status, id)
    }
    res.sendStatus(200);
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

app.post("/login-flow", async (req, res) => {
  try {
    const tenant_id = req.headers['X-Tenant-Id']
    const authCode = req.body.code;
    console.log("authCode: ", authCode)


    const access_token = await getAccessToken(authCode);
    console.log("access token: ", access_token);


    const waba_id = await getWabaID(access_token)
    console.log("waba_id: ", waba_id);

    const business_phone_number_id = await getPhoneNumberID(access_token, waba_id);
    console.log("bipd: ", business_phone_number_id)

    const register_response = registerAccount(business_phone_number_id, access_token)
    const postRegister_response = postRegister(access_token, waba_id)
    
    const response = axios.post(`${baseURL}/insert-data/`, {
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

// Run the clearInactiveSessions function every hour  
setInterval(clearInactiveSessions, 60 * 60 * 1000);
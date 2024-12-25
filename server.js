import express from "express";
import axios from "axios";
import NodeCache from 'node-cache';
import cors from 'cors';
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";

import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister, addKey } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, fastURL, djangoURL} from "./snm.js"
import { sendMessage, sendMessageTemplate  } from "./send-message.js"; 
import  { sendProduct, sendBill} from "./product.js"
import { updateStatus, addDynamicModelInstance, addContact, executeFallback, saveMessage, sendNotification, updateLastSeen, getIndianCurrentTime } from "./misc.js"
import { handleMediaUploads } from "./handle-media.js"
import {Worker, workerData} from "worker_threads"
import { messageQueue } from "./queues/messageQueue.js";


export const messageCache = new NodeCache({ stdTTL: 600 });

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

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});


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

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumbers, message, url, messageType, additionalData, business_phone_number_id, bg_id } = req.body;
    const tenant_id = req.headers['x-tenant-id'];
    console.log("Rcvd tenant id: ", tenant_id)
    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      
      let formattedPhoneNumber;
      if (phoneNumber.length === 10) {
        formattedPhoneNumber = `91${phoneNumber}`;
      } else {
        formattedPhoneNumber = phoneNumber; // Keep it as is if the length is not 10
      }
      const cacheKey = `${business_phone_number_id}_${tenant_id}`;
      
      let access_token = messageCache.get(cacheKey);
      if (!access_token) {
        try {
          const tenantRes = await axios.get(`${fastURL}/whatsapp_tenant/`, {
            headers: { 'X-Tenant-Id': tenant_id}
          });
          access_token = tenantRes.data.whatsapp_data[0].access_token;
          messageCache.set(cacheKey, access_token);

        } catch (error) {
          console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
          throw error;
        }
      }

      let sendMessagePromise;
      let fr_flag;
      switch (messageType) {
        case 'text':
          sendMessagePromise = sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token, tenant_id, fr_flag = true);
          break;
        case 'image':
          const { imageId, caption } = additionalData;
          console.log(`image ID: ${imageId}, caption: ${caption}`)
          sendMessagePromise = sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageId, caption, access_token, tenant_id, fr_flag = true);
          // formattedConversation.push({ text: caption, sender: "bot" });
          break;
        case 'audio':
          const { audioID } = additionalData;
          sendMessagePromise = sendAudioMessage(formattedPhoneNumber, business_phone_number_id, audioID, access_token,tenant_id, fr_flag = true);
          break;
        case 'video':
          const { videoID } = additionalData;
          sendMessagePromise = sendVideoMessage(formattedPhoneNumber, business_phone_number_id, videoID, access_token,tenant_id, fr_flag = true);
          break;
        case 'location':
          sendMessagePromise = sendLocationMessage(formattedPhoneNumber, business_phone_number_id, additionalData, access_token,tenant_id, fr_flag = true);
          break;
        default:
          throw new Error("Invalid message type");
      }

      const [ response] = await Promise.all([ sendMessagePromise]);


      const messageID = response.data?.messages[0]?.id;
      if (bg_id != null && messageID) {
        // updateStatus(null, messageID, business_phone_number_id, null, bg_id, tenant_id).catch(console.error);
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

app.post("/send-template", async (req, res) => {
  const { bg_id, bg_name, template, business_phone_number_id, phoneNumbers } = req.body;
  // const tenant_id = req.headers["x-tenant-id"];
  console.log("rcvd data: ", req.body)
  const templateName = template.name;
  const otp = template?.otp;

try {
    let responseData = messageCache.get(business_phone_number_id);

    // Fetch tenant data if not available in cache
    if (!responseData) {
      try {
        const response = await axios.get(`${fastURL}/whatsapp_tenant`, {
          headers: { bpid: business_phone_number_id },
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
    
    const jobData = {
      bg_id,
      bg_name,
      templateData,
      business_phone_number_id,
      access_token,
      otp,
      tenant_id,
      phoneNumbers, // Send all phone numbers to the worker
      batchSize: 80, // Set batch size for worker
    };
    console.log("Sending data to messageQueue")

    try {
      await messageQueue.add('message', jobData);
    } catch (error) {
      console.error("Error adding job to queue:", error.message);
      res.status(500).json({ success: false, error: "Failed to enqueue message." });
      return;
    }
    
    // Log the results of message sending
    // console.log("Message Sending Results:", JSON.stringify(results, null, 2));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message." });
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

async function getSession(business_phone_number_id, contact) {
  console.log("Contact: " ,contact)
  const userPhoneNumber = contact?.wa_id
  const userName = contact?.profile?.name || null

  let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);

  if (!userSession) {
      console.log(`Creating new session for user ${userPhoneNumber}`);
      try {
      let responseData = messageCache.get(business_phone_number_id)
      if(!responseData){
      const response = await axios.get(`${fastURL}/whatsapp_tenant`,{
          headers: {'bpid': business_phone_number_id}
      });
      responseData = response.data
      messageCache.set(business_phone_number_id, responseData)
      }
      console.log("Tenant data received:", responseData);
      const responseFlowData = responseData?.whatsapp_data
      let multilingual = responseData?.whatsapp_data[0].multilingual;
      let flowData;
      if (multilingual) flowData = responseData?.whatsapp_data
      else flowData = responseData?.whatsapp_data[0].flow_data

      
      const adjList = responseData?.whatsapp_data[0]?.adj_list
      const startNode = responseData?.whatsapp_data[0]?.start !== null ? responseData?.whatsapp_data[0]?.start : 0;
      const currNode = startNode
      // const multilingual = flowData.length > 1 ? true : false
      if(!flowData && !adjList) console.error("Flow Data is not present for bpid: ", business_phone_number_id)
      userSession = {
          AIMode: false,
          lastActivityTime: Date.now(),
          flowData: flowData,
          adjList: adjList,
          accessToken: responseData.whatsapp_data[0].access_token,
          flowName : responseData.whatsapp_data[0].flow_name,
          startNode : startNode,
          currNode: currNode,
          nextNode: adjList[currNode],
          business_phone_number_id: responseData.whatsapp_data[0].business_phone_number_id,
          tenant : responseData.whatsapp_data[0].tenant_id,
          userPhoneNumber : userPhoneNumber,
          userName: userName,
          inputVariable : null,
          inputVariableType: null,
          fallback_msg : responseData.whatsapp_data[0].fallback_message || "please provide correct input",
          fallback_count: responseData.whatsapp_data[0].fallback_count != null ? responseData.whatsapp_data[0].fallback_count : 1,
          products: responseData.catalog_data,
          language: null,
          multilingual: multilingual,
          doorbell: responseData.whatsapp_data[0]?.introductory_msg || null,
          api:  {
            POST: {},
            GET: {}
          }
      };

      const key = userPhoneNumber + business_phone_number_id
      
      userSessions.set(key, userSession);
      } catch (error) {
      console.error(`Error fetching tenant data for user ${userPhoneNumber}:`, error);
      throw error;
      }
  } else {
      userSession.lastActivityTime = Date.now()
      if(userSession.currNode != null) userSession.nextNode = userSession.adjList[userSession.currNode]
      else {
      userSession.currNode = userSession.startNode
      userSession.nextNode = userSession.adjList[userSession.currNode]
      }
  }

  return userSession;
}

async function handleInput(userSession, message) {
  if (userSession.inputVariable !== undefined && userSession.inputVariable !== null && userSession.inputVariable.length > 0){

      // if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
      //   console.log("Processing media message:", message?.type);
      //   const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
      //   console.log("Media ID:", mediaID);
      //   const doc_name = userSession.inputVariable
      //   try {
      //     console.log("Uploading file", userSession.tenant);
      //     await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
      //   } catch (error) {
      //     console.error("Error retrieving media content:", error);
      //   }
      //   console.log("Webhook processing completed successfully");
      // }
      // console.log(`Input Variable: ${userSession.inputVariable}`);
      // // console.log(`Input Variable Type: ${userSession.inputVariableType}`);
      // try{
      //   // let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
      
      //   // var validateResponse = await validateInput(userSession.inputVariable, userSelection)
        
      //   var validateResponse = "Yes"
      //   if(validateResponse == "No." || validateResponse == "No"){
      //     await executeFallback(userSession)
      //     res.sendStatus(200)
      //     return
      //   }else{
      //     let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
      
      //     const updateData = {
      //       phone_no : userSession.userPhoneNumber,
      //       [userSession.inputVariable] : userSelection
      //     }
      //     const modelName = userSession.flowName
          
      //     addDynamicModelInstance(modelName , updateData, userSession.tenant)

      //     console.log(`Updated model instance with data: ${JSON.stringify(updateData)}`);
      //     console.log(`Input Variable after update: ${userSession.inputVariable}`);
      //   }
      // } catch (error) {
      //   console.error("An error occurred during processing:", error);
      // }

    const input_variable = userSession.inputVariable
    userSession.api.POST[input_variable] = message?.text?.body
    userSession.inputVariable = null
  }
  return userSession;
}

async function processOrder(userSession, products) {
  let totalAmount = 0;
  const product_list = []
  console.log("Products: ", products)
  for (let product of products){
      console.log("Product: ", product)
      totalAmount+=product.item_price * product.quantity
      const product_id = product.product_retailer_id;
      console.log("product id: ", product_id)
      const product_name = userSession.products.find(product_c => product_c.product_id === product_id)
      console.log("product nameeeeee: ", product_name)
      product_list.push({"id": product_id, "quantity": product.quantity, "product_name": product_name.title})
  }
  console.log("Total Amount = ", totalAmount)
  // console.log(product_list)

  const response = await axios.post(`${djangoURL}/process-order/`, {order: product_list},{
      headers: {
          'X-Tenant-Id': userSession.tenant
      }
  })
  if (response.data.status == 'success'){
      await sendBill(totalAmount, product_list, userSession)
  }
  else if (response.data.status == 'failure'){
      const reason  = response.data.reason
      var failureMessage;
      if (reason == 'insufficient_quantity'){
          failureMessage = "We regret to inform you that your order could not be processed due to insufficient stock availability. We are actively working to replenish our inventory as soon as possible. We apologize for any inconvenience this may have caused."
          sendTextMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, failureMessage, userSession.accessToken, userSession.tenant)
      }
  }
}

async function handleQuery(message, userSession) {
  const query = message?.text?.body
  const data = {query: query, phone: userSession.userPhoneNumber}
  const headers = { 'X-Tenant-Id': userSession.tenant }

  const response = await axios.post(`${djangoURL}/query-faiss/`, data, {headers:  headers})

  let messageText = response.data
  const fixedMessageText = messageText.replace(/"/g, "'");
  const messageData = {
  type: "interactive",
  interactive: {
      type: "button",
      body: { text: fixedMessageText },
      action: {
      buttons: [
          {
          type: 'reply',
          reply: {
          id: "Exit AI",
          title: "Exit"
          } 
          }
      ]
      }
  }
  }
  sendMessage(userPhoneNumber, business_phone_number_id, messageData)
}

const languageMap = {
  'Hindi': 'hi',
  'English': 'en',
  'Marathi': 'mr',
  'Tamil': 'ta',
  'Telugu': 'te',
  'Gujarati': 'gu',
  'Bengali': 'bn',
  'Punjabi': 'pa',
  'Malayalam': 'ml',
  'Kannada': 'kn',
  'Odia': 'or',
  'Assamese': 'as',
  'Kashmiri': 'ks',
  'Urdu': 'ur',
  'Nepali': 'ne',
  'Sanskrit': 'sa',
  'Maithili': 'mai',
  'Dogri': 'doi',
  'Konkani': 'kok',
  'Bodo': 'bodo',
  'Sindhi': 'sd',
  'Manipuri': 'mni',
  'Santhali': 'sat',
  'Bhojpuri': 'bho',
  'Hinglish': 'hing'
};


app.post("/webhook", async (req, res) => {
  try {
      // console.log("Received Webhook: ", JSON.stringify(req.body, null, 6))
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
      const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
      const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
      const userPhoneNumber = contact?.wa_id || null;
      const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];
      const userName = contact?.profile?.name || null
      const products = message?.order?.product_items
      const repliedTo = message?.context?.id || null

      
      let timestamp = await getIndianCurrentTime()
      // console.log("INDIANT CT: ", timestamp)

      if (repliedTo !== null) updateStatus("replied", repliedTo, null, null, null, null, timestamp)


      // console.log("Rcvd Req: ",req.body, business_phone_number_id,contact,message,userPhoneNumber, JSON.stringify(statuses), userName)
      // console.log("Contact: ", userName)


      
      if (message) {
          let userSession = await getSession(business_phone_number_id, contact)
          
          if (!userSession.multilingual){

          const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)
          const notif_body = {content: `${userSession.userPhoneNumber} | New meessage from ${userSession.userName || userSession.userPhoneNumber}: ${message_text}`, created_on: timestamp}

          sendNotification(notif_body, userSession.tenant)
          updateLastSeen("replied", timestamp, userSession.userPhoneNumber, userSession.business_phone_number_id)
          // console.log("Extracted data:", {business_phone_number_id,contact,message,userPhoneNumber});
          addContact(userSession.userPhoneNumber, userSession.userName, userSession.tenant)


          // saving message to backend
          let formattedConversation = [{
          text: message_text,
          sender: "user"
          }];
          // console.log("Saving messagwe qith timeL ", timestamp)
          saveMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, formattedConversation, userSession.tenant, timestamp)

      
          // emitting temp user to frontend
          const temp_user = message?.text?.body?.startsWith('*/') ? message.text.body.split('*/')[1]?.split(' ')[0] : null;
          if(temp_user){
              io.emit('temp-user', {
                  temp_user: temp_user,
                  phone_number_id: userSession.business_phone_number_id,
                  contactPhone: userSession.userPhoneNumber,
                  time: timestamp
              });
              // console.log("Emitted temp_user message: ", temp_user)
          }

          io.emit('new-message', {
              message: {type: "text" ,text: {body: message_text}},
              phone_number_id: userSession.business_phone_number_id,
              contactPhone: userSession.userPhoneNumber,
              name: userSession.userName,
              time: timestamp
          });
          //console.log("Emitted new message: ", messageData)
      
          if (!userSession.AIMode) {
              //console.log("Processing in non-AI mode");
              //console.log("input vr: ", userSession.inputVariable)

              handleInput(userSession, message)
          
              if (message?.type === "interactive") {
                  // console.log("Processing interactive message");
                  let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
                  // console.log("User selection:", { userSelectionID, userSelection });
                  try {
                      // console.log("NextNode: ", userSession.nextNode)
                      for (let i = 0; i < userSession.nextNode.length; i++) {
                          // console.log(`Checking node ${userSession.nextNode[i]}:`, userSession.flowData[userSession.nextNode[i]]);
                          if (userSession.flowData[userSession.nextNode[i]].id == userSelectionID) {
                              userSession.currNode = userSession.nextNode[i];
                              // console.log("Matched node found. New currNode:", userSession.currNode);
                              userSession.nextNode = userSession.adjList[userSession.currNode];
                              // console.log("Updated nextNode:", userSession.nextNode);
                              userSession.currNode = userSession.nextNode[0];
                              // console.log("Final currNode:", userSession.currNode);
                              // console.log("Calling sendNodeMessage");
                              sendNodeMessage(userSession.userPhoneNumber, userSession.business_phone_number_id);
                              break; // Exit the loop when the condition is met
                          }
                      };
                      if(isNaN(userSelectionID)) await sendProduct(userSession, userSelectionID)
                  } catch (error) {
                      console.error('Error processing interactive message:', error);
                  }
              }
              else if (message?.type === "text" || message?.type == "image") {
                  // console.log("Processing text or image message");
                  // console.log(userSession.currNode, userSession.startNode)
                  const flow = userSession.flowData
                  const type = flow[userSession.currNode].type
                  console.log("Curr Node: ", userSession.currNode, "Start Node: ", userSession.startNode)
                  if (userSession.currNode != userSession.startNode){
                      if (['string', 'audio', 'video', 'location', 'image', 'AI'].includes(type)) {
                          console.log(`Storing input for node ${userSession.currNode}:`, message?.text?.body);
                          userSession.currNode = userSession.nextNode[0];
                          // console.log("Updated currNode:", userSession.currNode);
                      }
                      else if(['Button', 'List'].includes(type)){
                          await executeFallback(userSession)
                          res.sendStatus(200)
                          return
                      }
                  }
                  // console.log("Calling sendNodeMessage");
                  sendNodeMessage(userPhoneNumber,business_phone_number_id);
              }
              else if (message?.type =="order"){
                  await processOrder(userSession, products)
              }
          }
          else {
              if (message?.type == "interactive"){
                  let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
                  if (userSelectionID == "Exit AI"){
                      userSession.AIMode = false;
                      // console.log("Matched node found. New currNode:", userSession.currNode);
                      userSession.nextNode = userSession.adjList[userSession.currNode];
                      // console.log("Updated nextNode:", userSession.nextNode);
                      userSession.currNode = userSession.nextNode[0];
                      // console.log("Final currNode:", userSession.currNode);
                      // console.log("Calling sendNodeMessage");
                      sendNodeMessage(userPhoneNumber,business_phone_number_id);
                  }
              }else if(message?.type == "text"){
                  handleQuery(message, userSession)
              }
              else if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
                  // console.log("Processing media message:", message?.type);
                  const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
                  // console.log("Media ID:", mediaID);
                  const doc_name = userSession.inputVariable
                  try {
                      // console.log("Uploading file", userSession.tenant);
                      await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
                  } catch (error) {
                      console.error("Error retrieving media content:", error);
                  }
              }
          }
        }
        else{
          if (message?.type === "text"){
            const message_text = message?.text?.body
            const doorbell = userSession.doorbell
            // console.log("Doorbell: ", doorbell)
            const doorbell_text = doorbell?.message
            const language_data = doorbell?.languages
            const languages = Object.entries(language_data).map(([id, name]) => ({
              id: parseInt(id), // Convert the string keys to integers
              name: name
            }));

            const languageKeys = Object.keys(language_data);
            const languageValues = Object.values(language_data)
            // console.log("Message Text: ", message_text)
            // console.log("Keys: ", languageKeys)
            // console.log("Values: ", languageValues)
            if (languageKeys.includes(message_text) || languageValues.includes(message_text)){
              let lang_code;
              if (languageKeys.includes(message_text)){
                // console.log("language keys")
                const language = language_data[message_text]
                // console.log("LAnguage: ", language)
                lang_code = languageMap[language]
                // console.log("Lang code: ", lang_code)
              }else{
                // console.log("language values")
                lang_code = languageMap[message_text]
              }
              
              const flowData = userSession.flowData
              userSession.language = lang_code
              const selectedFlowData = flowData.find(data => data.language === lang_code);
              // console.log("Selected flow data: ", selectedFlowData)
              userSession.flowData = selectedFlowData?.flow_data
              userSession.multilingual = false
              // console.log("Changing fallback language: ", selectedFlowData?.fallback_message)
              userSession.fallback_msg = selectedFlowData?.fallback_message
              // console.log("New fallback: ", userSession.fallback_msg)
              sendNodeMessage(userPhoneNumber,business_phone_number_id);

            }
            else{
              sendLanguageSelectionMessage(doorbell_text, userSession.accessToken, userSession.userPhoneNumber, userSession.business_phone_number_id, userSession.tenant)
            }

            

            // if(languages.length<=3){
            //   sendLanguageSelectionButtonMessage(languages, message_text, userSession.accessToken, userSession.userPhoneNumber, userSession.business_phone_number_id, userSession.tenant)
            // }
            // else if(languages.length>3 && languages.length<=10){
            //   sendLanguageSelectionListMessage(languages, message_text, userSession.accessToken, userSession.userPhoneNumber, userSession.business_phone_number_id, userSession.tenant)
            // }
            // else{
            //   sendLanguageSelectionMessage(message_text, userSession.accessToken, userSession.userPhoneNumber, userSession.business_phone_number_id, userSession.tenant)
            // }

            // const languages = [
            //   {
            //     id: "hi",
            //     name: "Hindi"
            //   },
            //   {
            //     id: "as",
            //     name: "Assamese"
            //   },
            //   {
            //     id: "mr",
            //     name: "Marathi"
            //   },
            //   {
            //     id: "bn",
            //     name: "Bengali"
            //   },
            //   {
            //     id: "or",
            //     name: "Oriya"
            //   }
            // ]
            
          }
          if (message?.type === "interactive") {
            let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
            userSession.language = userSelectionID;
            const flowData = userSession.flowData
            // console.log("Is flowData an array?", Array.isArray(flowData));
            // console.log("Type of flowData:", typeof flowData);
            // console.log("Value of flowData:", flowData);

            const selectedFlowData = flowData.find(data => data.language === userSelectionID);
            // console.log("Selected flow data: ", selectedFlowData)
            userSession.flowData = selectedFlowData?.flow_data
            userSession.multilingual = false
            // console.log("Changing fallback language: ", selectedFlowData?.fallback_message)
            userSession.fallback_msg = selectedFlowData?.fallback_message
            // console.log("New fallback: ", userSession.fallback_msg)
            sendNodeMessage(userPhoneNumber,business_phone_number_id);

          }
        }
      }

      if (statuses) {
          // console.log("Webhook received:", JSON.stringify(req.body, null, 2));
          const status = statuses?.status
          const id = statuses?.id
          const userPhone = statuses?.recipient_id
          const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

          if (status == "failed"){
              updateStatus(status, id, null, null, null, null, timestamp)
              const error = statuses?.errors[0]
              console.log("Message failed: ", error)
              io.emit('failed-response', error)
              // res.status(400).json(error)
          }
          else if(status == "delivered"){
              updateStatus(status, id, null, null, null, null, timestamp)
              console.log("Delivered: ", userPhone)
              updateLastSeen("delivered", timestamp, userPhone, business_phone_number_id)
          }
          else if(status == "read"){
              updateStatus(status, id, null, null, null, null, timestamp)
              updateLastSeen("seen", timestamp, userPhone, business_phone_number_id)
          }
          console.log("Webhook Processing Complete")
      }
      console.log("Webhook processing completed successfully");
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

async function sendLanguageSelectionButtonMessage(language_list, message,access_token, phoneNumber, business_phone_number_id, tenant_id) {
console.log("LANGUAGE LIST: ", language_list)
  let button_rows = language_list.map(buttonNode => ({
      type: 'reply',
      reply: {
          id: buttonNode.id,
          title: buttonNode.name
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
const fr_flag = false
return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)
  }

async function sendLanguageSelectionListMessage(language_list, message, access_token, phoneNumber, business_phone_number_id, tenant_id) {
  
  const rows = language_list.map((listNode) => ({
    id: listNode.id,
    title: listNode.name
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

const fr_flag = false
return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)

}

async function sendLanguageSelectionMessage(message_text, access_token, phoneNumber, business_phone_number_id, tenant_id) {
  console.log("Doorbell Text: ", message_text)
  const messageData = {
    type: "text",
    text: {
      body: message_text
    }
  }

  const fr_flag = false
return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, fr_flag, tenant_id)

}

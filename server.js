import express from "express";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import session from "express-session";

import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendProductMessage, sendListMessage, sendInputMessage, sendButtonMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, baseURL} from "./snm.js"
import { sendMessage  } from "./send-message.js"; 
import  { sendProduct, sendBill, sendBillMessage, sendProductList, sendProduct_List } from "./product.js"
import { validateInput, updateStatus, replacePlaceholders, addDynamicModelInstance, addContact, executeFallback, getTenantFromBpid, saveMessage } from "./misc.js"
import { getMediaID, handleMediaUploads, checkBlobExists, getImageAndUploadToBlob } from "./handle-media.js"

import NodeCache from 'node-cache';
import FormData from "form-data";
import { travel_ticket_prompt } from './PROMPTS.js'


const messageCache = new NodeCache({ stdTTL: 600 });

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
    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      const formattedPhoneNumber = `91${phoneNumber}`;
      const cacheKey = `${business_phone_number_id}_${tenant_id}`;
      
      let access_token = messageCache.get(cacheKey);
      if (!access_token) {
        try {
          const tenantRes = await axios.get(`${baseURL}/whatsapp_tenant/`, {
            headers: { 'X-Tenant-Id': tenant_id}
          });
          access_token = tenantRes.data.access_token;
          messageCache.set(cacheKey, access_token);
        } catch (error) {
          console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
          throw error;
        }
      }
      // let formattedConversation = [{ text: message, sender: "bot" }];
      // const saveConversationPromise = fetch(`${baseURL}/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Tenant-Id': 'll'
      //   },
      //   body: JSON.stringify({
      //     contact_id: formattedPhoneNumber,
      //     business_phone_number_id: business_phone_number_id,
      //     conversations: formattedConversation,
      //     tenant: 'll',
      //   }),
      // });

      let sendMessagePromise;
      let fr_flag;
      switch (messageType) {
        case 'text':
          sendMessagePromise = sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token, tenant_id, fr_flag = true);
          break;
        case 'image':
          const { imageId, caption } = additionalData;
          console.log(`image ID: ${imageId}, caption: ${caption}`)
          sendMessagePromise = sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageId, caption, access_token, fr_flag = true);
          // formattedConversation.push({ text: caption, sender: "bot" });
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

      const [ response] = await Promise.all([ sendMessagePromise]);


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

app.post("/send-template", async(req, res) => {
  const { bg_id, template, business_phone_number_id, phoneNumbers } = req.body
  const tenant_id = req.headers['x-tenant-id'];
  
  const templateName = template.name
  // for otps
  const otp = template?.otp
  console.log(`tenant ID: ${tenant_id}`)
  try {
    const tenantRes = await axios.get(`${baseURL}/whatsapp_tenant/`, {
      headers: { 'X-Tenant-Id': tenant_id }
    });
    console.log("TENANT RES: ", tenantRes)
    const access_token = tenantRes.data.access_token;
    const account_id = tenantRes.data.business_account_id;
    console.log(`access token: ${access_token}, account ID: ${account_id}`)
    
    const response  = await axios.get(`https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`, {
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

        const messageData = await setTemplate(templateData, phoneNumber, business_phone_number_id, access_token, otp)

        const sendMessage_response = await sendMessage(formattedPhoneNumber, business_phone_number_id, messageData, access_token);
        
        const messageID = sendMessage_response.data?.messages[0]?.id;
        if (bg_id != null) {
          updateStatus(null, messageID, null, null, bg_id);
        }

        // Save conversation to backend
        // const formattedConversation = [{ text: template.name, sender: "bot" }];
        // const saveRes = await fetch(`${baseURL}/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'X-Tenant-Id': tenant_id 
        //   },
        //   body: JSON.stringify({
        //     contact_id: formattedPhoneNumber,
        //     business_phone_number_id: business_phone_number_id,
        //     conversations: formattedConversation,
        //     tenant: tenant_id ,
        //   }),
        // });
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
    console.log("Received Webhook: ", JSON.stringify(req.body, null, 6))
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;
    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];
    const userName = contact?.profile?.name || null
    const products = message?.order?.product_items
    console.log("Rcvd Req: ",req.body, business_phone_number_id,contact,message,userPhoneNumber, JSON.stringify(statuses), userName)
    console.log("Contact: ", userName)

    // for handling messages
    if (message) {
      console.log("Extracted data:", {
        business_phone_number_id,
        contact,
        message,
        userPhoneNumber
      });

      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
      if (!userSession) {
        console.log(`Creating new session for user ${userPhoneNumber}`);
        try {
          
          // get tenant from bpid
          const tenant = await getTenantFromBpid(business_phone_number_id)
          const response = await axios.get(`${baseURL}/whatsapp_tenant/`,{
            headers: {'X-Tenant-Id': tenant} 
          });
          console.log("Tenant data received:", response.data);
          const flowData = response.data.flow_data
          // let flowData = JSON.parse(flowData1);
          const adjList = response.data.adj_list
          // let adjList = JSON.parse(adjList1)
  
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
            AIMode: false,
            lastActivityTime: Date.now(),
            flowData: flowData,
            adjList: adjList,
            accessToken: response.data.access_token,
            flowName : response.data.flow_name,
            startNode : startNode,
            currNode: currNode,
            nextNode: adjList[currNode],
            business_number_id: response.data.business_phone_number_id,
            tenant : response.data.tenant,
            userPhoneNumber : userPhoneNumber,
            userName: userName,
            inputVariable : null,
            inputVariableType: null,
            fallback_msg : response.data.fallback_msg || "please provide correct input",
            fallback_count: response.data.fallback_count != null ? response.data.fallback_count : 1,
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

      // add contact 
      if(userName && userPhoneNumber){
        const contact_data = {
          phone: userSession.userPhoneNumber,
          name: userSession.userName
        }
        addContact(contact_data, userSession.tenant)
      }

      // updating status 
      const repliedTo = message?.context?.id || null
      if (repliedTo !== null) {
        console.log("updating status: ", repliedTo)
        updateStatus("replied", repliedTo)
      }

      // saving message to backend
      let formattedConversation = [{
        text: message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null),
        sender: "user"
      }];
      saveMessage(userSession.userPhoneNumber, userSession.business_number_id, formattedConversation, userSession.tenant)

      
      // emitting to frontend
      const now = Date.now()
      const timestamp = now.toLocaleString();
      const messageData = {
        type: "text",
        text: { body: message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null) }
      }
      console.log("Emitting new message event");
      try{
        io.emit('new-message', {
          message: messageData,
          phone_number_id: userSession.business_number_id,
          contactPhone: userSession.userPhoneNumber,
          name: userName,
          time: timestamp
        });
        console.log("Emitted node message: ", messageData)
      }catch(error){
        console.log("error occured while emission: ", error)
      }

      // emitting temp user to frontend
      const temp_user = message?.text?.body?.startsWith('*/') ? message.text.body.split('*/')[1]?.split(' ')[0] : null;
      if(temp_user){
        try{
          io.emit('temp-user', {
            temp_user: temp_user,
            phone_number_id: userSession.business_number_id,
            contactPhone: userPhoneNumber,
            time: timestamp
          });
          
          console.log("Emitted temp_user message: ", messageData)
        }catch(error){
          console.log("error occured while emission of temp_user: ", error)
        }
      }


      
      if (!userSession.AIMode) {
        let sendDynamicPromise;
        console.log("input vr: ", userSession.inputVariable)
        if (userSession.inputVariable !== undefined && userSession.inputVariable !== null && userSession.inputVariable.length > 0){
          if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
            console.log("Processing media message:", message?.type);
            const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
            console.log("Media ID:", mediaID);
            const doc_name = userSession.inputVariable
            try {
              console.log("Uploading file", userSession.tenant);
              await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
            } catch (error) {
              console.error("Error retrieving media content:", error);
            }
            console.log("Webhook processing completed successfully");
          }
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
              const modelName = userSession.flowName
              
              sendDynamicPromise = addDynamicModelInstance(modelName , updateData, userSession.tenant)

              console.log(`Updated model instance with data: ${JSON.stringify(updateData)}`);
              console.log(`Input Variable after update: ${userSession.inputVariable}`);
            }
          } catch (error) {
            console.error("An error occurred during processing:", error);
            if (!res.headersSent) {
              res.sendStatus(500);
            }
          }
        userSession.inputVariable = null
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
            if(isNaN(userSelectionID)) await sendProduct(userSession, userSelectionID)
          } catch (error) {
            console.error('Error processing interactive message:', error);
          }
        }
        else if (message?.type === "text" || message?.type == "image") {
          console.log("Processing text or image message");
          console.log(userSession.currNode, userSession.startNode)
          const flow = userSession.flowData
          const type = flow[userSession.currNode].type
          if (userSession.currNode != userSession.startNode){
            console.log("TYPEPEPEPEP:", type)
            if (['Text', 'string', 'audio', 'video', 'location', 'image', 'AI'].includes(type)) {
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
        else if (message?.type =="order"){
          let totalAmount = 0;
          const product_list = []
          console.log("Products: ", products)
          for (let product of products){
            console.log("Product: ", product)
            totalAmount+=product.item_price * product.quantity
            const product_id = product.product_retailer_id;
            console.log("product id: ", product_id)
            const product_name = userSession.products.find(product => product.id === product_id)
            console.log("product nameeeeee: ", product_name)
            product_list.push({"id": product_id, "quantity": product.quantity, "product_name": product_name.name})
          }
          console.log("Total Amount = ", totalAmount)
          console.log(product_list)

          const response = await axios.post(`${baseURL}/process-order/`, {
            order: product_list
          },{
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
              sendTextMessage(userSession.userPhoneNumber, userSession.business_number_id, failureMessage, userSession.accessToken)
            }
          }
          // await sendProduct(userSession)
        }
        
      } else {
        if (message?.type == "interactive"){
          let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
          if (userSelectionID == "Exit AI"){
            userSession.AIMode = false;
            console.log("Matched node found. New currNode:", userSession.currNode);
            userSession.nextNode = userSession.adjList[userSession.currNode];
            console.log("Updated nextNode:", userSession.nextNode);
            userSession.currNode = userSession.nextNode[0];
            console.log("Final currNode:", userSession.currNode);
            console.log("Calling sendNodeMessage");
            sendNodeMessage(userPhoneNumber,business_phone_number_id);
          }
        }else if(message?.type == "text"){
          const query = message?.text?.body
          const data = {query: query, phone: userPhoneNumber}
          const headers = { 'X-Tenant-Id': tenant }

          response = await axios.post(`${baseURL}/query-faiss/`, data, {headers:  headers})

          let messageText = response.data
          const messageData = {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: messageText },
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
          await sendMessage(userPhoneNumber, business_phone_number_id, messageData)
        }
        else if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
          console.log("Processing media message:", message?.type);
          const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
          console.log("Media ID:", mediaID);
          const doc_name = userSession.inputVariable
          try {
            console.log("Uploading file", userSession.tenant);
            await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
          } catch (error) {
            console.error("Error retrieving media content:", error);
          }
          console.log("Webhook processing completed successfully");
        }
        console.log("Processing in AI mode");
      }
    }

    // for status update
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

setInterval(clearInactiveSessions, 60 * 60 * 1000);
// Run the clearInactiveSessions function every hour

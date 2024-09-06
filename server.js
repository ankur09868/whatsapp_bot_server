import express from "express";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import session from "express-session";
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { sendNodeMessage, sendImageMessage, sendButtonMessage, sendTextMessage, sendMessage } from "./snm.js";



const AIMode=false;
const WEBHOOK_VERIFY_TOKEN = "COOL";
const PORT = 8080;
const app = express();
const httpServer = createServer(app);
const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'https://69af-14-142-75-54.ngrok-free.app', 'https://whatsappbotserver.azurewebsites.net'];

export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'https://69af-14-142-75-54.ngrok-free.app', 'https://whatsappbotserver.azurewebsites.net'],
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

  try {
    // Determine status flags based on input
    if (status === "read") {
      isRead = true;
      isDelivered = true;
      isSent = true;
    } else if (status === "delivered") {
      isDelivered = true;
      isSent = true;
    } else if (status === "sent") {
      isSent = true;
    }

    // Prepare data to send
    const data = {
      business_phone_number_id: business_phone_number_id,
      is_read: isRead,
      is_delivered: isDelivered,
      is_sent: isSent,
      user_phone: user_phone,
      message_id: message_id,
      bg_id : broadcastGroup_id
    };

    console.log("Sending request with data:", data);

    // Send POST request with JSON payload
    const response = await axios.post(" https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/set-status/", data, {
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

export async function addDynamicModelInstance(modelName, updateData) {
  const url = `dynamic-model-data/${modelName}/`;
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
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(`Failed to update data: ${error.response.status}, ${error.response.data}`);
      } else if (error.request) {
          // The request was made but no response was received
          console.error('No response received:', error.request);
      } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error in setting up the request:', error.message);
      }
      console.error('Config details:', error.config);
      return null;
  }
}

async function sendTemplates(template){
  const templateData = {
    type: "template",
    template: template
  }
  return templateData
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
    const urlbool = url;
    console.log("quwudhwueduwcbwubduebwubdwud", req.body);
    console.log("myname is chiki chiki chik chik", business_phone_number_id);
    
    for (const phoneNumber of phoneNumbers) {
      const formattedPhoneNumber = `91${phoneNumber}`;
      let access_token;
      
      try {
        const tenantRes = await axios.get(` https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_tenant?business_phone_id=${business_phone_number_id}`, {
          headers: { 'X-Tenant-Id': 'll' }
        });
        access_token = tenantRes.data.access_token;
      } catch (error) {
        console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
        throw error;
      }
      
      let response;
      let formattedConversation = [{ text: message , sender: "bot" }];
      try {
        const saveRes = await fetch(`https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': 'll'
          },
          body: JSON.stringify({
            contact_id: formattedPhoneNumber,
            conversations: formattedConversation,
            tenant: 'll',
          }),
        });
        if (!saveRes.ok) throw new Error("Failed to save conversation");
      } catch (error) {
        console.error("Error saving conversation:", error.message);
      }
      switch (messageType) {
        case 'text':
          response = await sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token);
          formattedConversation.push({ text: message, sender: "bot" });
          break;

        case 'image':
          const { imageUrl, caption } = additionalData;
          response = await sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageUrl, caption, access_token);
          formattedConversation.push({ text: caption, sender: "bot" });
          break;

        case 'button':
          const { buttons } = additionalData;
          response = await sendButtonMessage(formattedPhoneNumber, business_phone_number_id, message, buttons, access_token);
          formattedConversation.push({ text: message, sender: "bot" });
          break;

        default:
          throw new Error("Invalid message type");
      }

      const messageID = response.data?.messages[0]?.id;
      if (bg_id != null) await updateStatus(null, messageID, null, null, bg_id);

      // Save conversation to backend
     
    }

    res.status(200).json({ success: true, message: "WhatsApp message(s) sent and saved successfully" });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message" });
  }
});
app.post("/send-template", async (req, res) => {
  const { bg_id, template, business_phone_number_id, phoneNumbers } = req.body;
  const templateData = {
    type: "template",
    template: {
      name: template.name,
      language: {
        code: "en_US"
      },
    }
  };
  
  try {
    const tenantRes = await axios.get(` https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_tenant?business_phone_id=${business_phone_number_id}`, {
      headers: { 'X-Tenant-Id': 'll' }
    });
    const access_token = tenantRes.data.access_token;

    for (const phoneNumber of phoneNumbers) {
      try {
        const formattedPhoneNumber = `${phoneNumber}`;
        const response = await sendMessage(formattedPhoneNumber, business_phone_number_id, templateData, access_token);
        
        const messageID = response.data?.messages[0]?.id;
        if (bg_id != null) {
          await updateStatus(null, messageID, null, null, bg_id);
        }

        // Save conversation to backend
        const formattedConversation = [{ text: template.name, sender: "bot" }];
        const saveRes = await fetch(`https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_convo_post/${formattedPhoneNumber}/?source=whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': 'll'
          },
          body: JSON.stringify({
            contact_id: formattedPhoneNumber,
            conversations: formattedConversation,
            tenant: 'll',
          }),
        });
        if (!saveRes.ok) throw new Error("Failed to save conversation");
      } catch (error) {
        console.error(`Failed to send message to ${phoneNumber}:`, error);
      }
    }

    res.status(200).json({ success: true, message: "WhatsApp message(s) sent and saved successfully" });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message" });
  }
});



app.post("/webhook", async (req, res) => {
  try {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id;
    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];
    
    

    if (message) {
      console.log("Extracted data:", {
        business_phone_number_id,
        contact,
        message,
        userPhoneNumber
      });

      console.log("Emitting new message event");
        
      let formattedConversation = [
        {
          text: message?.text?.body || 
                (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null),
          sender: "user"
        }
      ];
        
        // Save conversation to backend
        try {
          const saveRes = await fetch(`https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_convo_post/${userPhoneNumber}/?source=whatsapp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': 'll'
            },
            body: JSON.stringify({
              contact_id: userPhoneNumber,
              conversations: formattedConversation,
              tenant: 'll',
            }),
          });
          if (!saveRes.ok) throw new Error("Failed to save conversation");
        } catch (error) {
          console.error("Error saving conversation:", error.message);
        }
      io.emit('new-message', {
        message: message?.text?.body || message?.interactive?.body,
        phone_number_id: business_phone_number_id,
        contactPhone: contact
      });
      
  
      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
      if (!userSession) {
        console.log(`Creating new session for user ${userPhoneNumber}`);
        try {
          const response = await axios.get(` https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/whatsapp_tenant?business_phone_id=${business_phone_number_id}`,{
            headers: {'X-Tenant-Id': 'll'} 
          });
          const flowData = response.data.flow_data
          const adjList = response.data.adj_list
          // console.log("Tenant data received:", response.data);
  
          // Validate the data types
          if (!Array.isArray(flowData)) {
            throw new Error("flowData is not an array");
          }
          if (!Array.isArray(adjList) || !adjList.every(Array.isArray)) {
            throw new Error("adjList is not an array of arrays");
          }
          userSession = { 
            flowData: response.data.flow_data,
            adjList: response.data.adj_list,
            accessToken: response.data.access_token,
            currNode: 0,
            nextNode:adjList[0],
            business_number_id:business_phone_number_id,
            inputVariable : null
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
          userSession.nextNode = userSession.adjList[0]
          userSession.currNode = 0
        }
        // console.log(`Existing session found for user ${userPhoneNumber}:`, userSession);
      }
      if (!AIMode) {
        
        if (userSession.inputVariable != null){
          console.log(userSession.inputVariable)
          const updateData = {
            phone_no : userPhoneNumber,
            [userSession.inputVariable] : message.text?.body
          }
          userSession.inputVariable = null
          await addDynamicModelInstance('ModelName' , updateData)
          console.log(userSession.inputVariable)
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
        if (message?.type === "text") {
          console.log("Processing text message");
          if (userSession.currNode != 0) {
            console.log(`Storing input for node ${userSession.currNode}:`, message?.text?.body);
            //userSession.inputMap.set(userSession.currNode, message?.text?.body);
            userSession.currNode = userSession.nextNode[0];
            console.log("Updated currNode:", userSession.currNode);
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
      
      await updateStatus(status, id)
      console.log(status, id)

    }
  
    res.sendStatus(200);
  } catch (error) {
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
    const authCode = req.body.code;
    const access_token = await getAccessToken(authCode);
    const waba_id = await getWabaID(access_token)
    const business_phone_number_id = await getPhoneNumberID(access_token, waba_id);
    const register_response = await registerAccount(business_phone_number_id, access_token)
    const response = axios.post(" https://backenreal-hgg2d7a0d9fzctgj.eastus-01.azurewebsites.net/insert-flow/", {
      business_phone_number_id : business_phone_number_id,
      access_token : access_token,
      accountID : waba_id,
      firstInsert : true
    })
    const postRegister_response = await postRegister(access_token)
    
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

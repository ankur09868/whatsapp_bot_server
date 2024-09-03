import express from "express";
import axios from "axios";
import { createServer } from "http";
//import sendWhatsappMessage from './send_whatsapp_msg.js';
import { Server } from "socket.io";
import cors from 'cors';
import session from "express-session";
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, subscribeAppToPage } from "./login-flow.js";
import {createTemplate} from './createTemplate.js';
const AIMode=false;
const WEBHOOK_VERIFY_TOKEN = "COOL";
//const GRAPH_API_TOKEN = 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P';
const PORT = 8080;


var AI_Replies = true;
//var AIMode = false;
let userSessions = new Map();


//var currNode = 0;
//let zipName;
//let prompt;
//let lastMessage_id;
//var count = 0;
//let business_phone_number_id = 241683569037594;
//var contact;
const app = express();
const httpServer = createServer(app);
app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'https://69af-14-142-75-54.ngrok-free.app', 'https://whatsappbotserver.azurewebsites.net'],
    methods: ['GET', 'POST']
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});

app.use(express.json());

const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'https://69af-14-142-75-54.ngrok-free.app', 'https://whatsappbotserver.azurewebsites.net'];

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
// Session setup
app.use(session({
  secret: 'my_whatsapp_nuren_adarsh',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }  // Set to true if you're using HTTPS
}));
var adjList;
var flow;
app.post("/create-template", async (req, res) => {
    try {
      const {
        accessToken,
        name,
        category,
        allowCategoryChange,
        language,
        libraryTemplateName,
        libraryTemplateButtonInputs,
        components,
        business_account_number_id
      } = req.body;
  
      // Call the createTemplate function with the data from the request body
      const templateResponse = await createTemplate(
        accessToken,
        name,
        category,
        allowCategoryChange,
        language,
        libraryTemplateName,
        libraryTemplateButtonInputs,
        components,
        business_account_number_id
      );
  
      // Send back the response from the API
      res.status(200).json({
        message: 'Template created successfully',
        data: templateResponse
      });
    } catch (error) {
      console.error('Error in /create-template route:', error);
      res.status(500).send('Error occurred during template creation');
    }
  });
app.post("/flowdata", async (req, res) => {
  adjList=req.body.adjacencyList;
  flow=req.body.nodes;
  console.log("rec data: ", req.body);


  res.status(200).json({ success: true, message: "flowdata sent successfully" });
})
// const business_phone_number_id='241683569037594'
// const GRAPH_API_TOKEN='EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P'

async function sendMessage(phoneNumber, messageData) {
    const url = `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`;
    console.log('Sending message to:', phoneNumber);
    console.log('Message Data:', messageData);
  
    try {
      const response = await axios.post(url, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        ...messageData
      }, {
        headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
      });
  
      console.log('Message sent successfully:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Failed to send message:', error.response ? error.response.data : error.message);
      return { success: false, error: error.response ? error.response.data : error.message };
    }
  }

  async function sendTextMessage(userPhoneNumber,message){
    const userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${userSession.business_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${userSession.accessToken}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: userPhoneNumber,
        type: "text",
        text: {
          body: message
        }
      }
    });
  }


async function sendImageMessage(phoneNumber, imageUrl, caption) {
    
  const messageData = {
    type: "image",
    image: {
      link: imageUrl,
      caption: caption
    }
  };
  console.log("IMAGEEEE");
  return sendMessage(phoneNumber, messageData);
}

async function sendButtonMessage(buttons, message, phoneNumber) {
    const userSession = userSessions.get(phoneNumber+business_phone_number_id);
    flow = userSession.flowData
    try {
        let button_rows = buttons.map(buttonNode => ({
          type: 'reply',
          reply: {
            id: flow[buttonNode].id,
            title: flow[buttonNode].body
          }
        }));
    console.log("button_row:" ,button_rows)
    const response = await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: message },
      action: { buttons: button_rows }
    }
  }, {
    headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
  });

  console.log('Button message sent successfully:', response.data);
  return { success: true, data: response.data };
} catch (error) {
  console.error('Failed to send button message:', error.response ? error.response.data : error.message);
  return { success: false, error: error.response ? error.response.data : error.message };
}
  }
  
  async function sendInputMessage(userPhoneNumber,message){
    const userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${userSession.business_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${userSession.accessToken}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: userPhoneNumber,
        type: "text",
        text: {
          body: message
        }
      }
    });
  }
async function sendListMessage(list, message, phoneNumber) {
  const userSession = userSessions.get(phoneNumber+business_phone_number_id);
  flow = userSession.flowData

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
  return sendMessage(phoneNumber, messageData);
}

async function sendNodeMessage(userPhoneNumber) {
    const userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
    if (!userSession) {
      console.error(`No session found for user ${userPhoneNumber}`);
      return;
    }
    console.log("session for node message: ", userSession)
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
          await sendButtonMessage(buttons, node_message, userPhoneNumber);
          break;
       
        case "List":
          const list = nextNode
          await sendListMessage(list, node_message, userPhoneNumber);
          break;
        case "Input":
            await sendInputMessage(userPhoneNumber, node_message);
            break;
            
        case "string":
          await sendTextMessage(userPhoneNumber, node_message);
          userSession.currNode = nextNode[0] || null;
          console.log("string currNode: ", userSession.currNode)
          if(userSession.currNode!=null) {
            
            await sendNodeMessage(userPhoneNumber)
          }
          
          break;
        case "image":
          await sendImageMessage(userPhoneNumber, node_message, flow[currNode]?.body?.url);
          break;
        case "AI":
          await sendTextMessage(userPhoneNumber, node_message);
          userSession.AIMode = true;
          break;
        default:
          console.log(`Unknown node type: ${flow[currNode]?.type}`);
      }
  
      userSession.nextNode = nextNode;
      userSessions.set(userPhoneNumber, userSession);
    } else {
      userSession.currNode = 0;
      userSession.nextNode = adjListParsed[userSession.currNode] || [];
      
    }
  }
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
    const { phoneNumbers, message, url, messageType, additionalData } = req.body; // `additionalData` will include any extra information needed for specific message types
    const urlbool = url;
   // const tenantId = req.headers['x-tenant-id'];

    // Fetch tenant-specific details (e.g., access_token, business_phone_number_id) from the tenantId
    //const { access_token, business_phone_number_id } = getTenantDetails(tenantId);

    //if (!tenantId) {
  //    return res.status(400).send('Tenant ID missing');
   // }

    for (const phoneNumber of phoneNumbers) {
      const formattedPhoneNumber = `91${phoneNumber}`;

      switch (messageType) {
        case 'text':
          await sendTextMessage(formattedPhoneNumber, message);
          break;

        case 'image':
          const { imageUrl, caption } = additionalData;
          await sendImageMessage(formattedPhoneNumber,imageUrl,caption);
          break;

        case 'button':
          const { buttons } = additionalData;
          await sendButtonMessage(formattedPhoneNumber,message,buttons);
          break;

        default:
          throw new Error("Invalid message type");
      }
    }

    res.status(200).json({ success: true, message: "WhatsApp message(s) sent successfully" });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message" });
  }
});
// Webhook endpoint
app.post("/webhook", async (req, res) => {
    try {
      // console.log("Webhook received:", JSON.stringify(req.body, null, 2));
  
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
        io.emit('new-message', {
          message: message?.text?.body || message?.interactive?.body,
          phone_number_id: business_phone_number_id,
          contactPhone: contact
        });
      
  
      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
      if (!userSession&&userPhoneNumber) {
        console.log(`Creating new session for user ${userPhoneNumber}`);
        try {
          const response = await axios.get(`http://127.0.0.1:8000/whatsapp_tenant?business_phone_id=${business_phone_number_id}`,{
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
          userSession = {
           
            flowData: response.data.flow_data,
            adjList: response.data.adj_list,
            accessToken: response.data.access_token,
            currNode: 0,
            nextNode:adjList[0],
            business_number_id:business_phone_number_id,
            inputMap: new Map()
          };
          userSessions.set(userPhoneNumber, userSession);
          console.log(`New session created for user ${userPhoneNumber}:`, userSession);
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
        console.log(`Existing session found for user ${userPhoneNumber}:`, userSession);
      }
  
      if (!AIMode) {
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
                sendNodeMessage(userPhoneNumber);
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
          sendNodeMessage(userPhoneNumber);
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
      if (statuses) console.log(statuses?.status, statuses?.id)
  
      res.sendStatus(200);
    } catch (error) {
      console.error("Error in webhook handler:", error);
      res.sendStatus(500);
    }
  });
// Send node message function


app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
  
    // check the mode and token sent are correct
    if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      // respond with 200 OK and challenge token from the request
      res.status(200).send(challenge);
      console.log("Webhook verified successfully!");
    } else {
      // respond with '403 Forbidden' if verify tokens do not match
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
      const subscribe_app_to_page=await subscribeAppToPage(waba_id,access_token);
      const response = axios.post("http://localhost:8000/insert-flow/", {
        business_phone_number_id : business_phone_number_id,
        access_token : access_token,
        accountID : waba_id,
        firstInsert : true
      })

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
        userSessions.delete(userPhoneNumber+business_phone_number_id);
      }
    }
  }
  
  // Run the clearInactiveSessions function every hour
  setInterval(clearInactiveSessions, 60 * 60 * 1000);
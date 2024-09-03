import express from "express";
import axios from "axios";
import { createServer } from "http";
//import sendWhatsappMessage from './send_whatsapp_msg.js';
import { Server } from "socket.io";
import cors from 'cors';
import session from "express-session";
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
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
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
app.post("/flowdata", async (req, res) => {
  adjList=req.body.adjacencyList;
  flow=req.body.nodes;
  console.log("rec data: ", req.body);


  res.status(200).json({ success: true, message: "flowdata sent successfully" });
})
const business_phone_number_id='241683569037594'
const GRAPH_API_TOKEN='EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P'
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
  async function sendListMessage(userPhoneNumber,list, message){
    const userSession = userSessions.get(userPhoneNumber);
    const actionSections = [];
    const rows = [];
  
    for (let i = 0; i < list.length; i++) {
      listNode=list[i]
      rows.push({
        id: `list-${i + 1}`,
        title: flow[listNode].body,
      });
    }
  
    actionSections.push({
      title: "Section Title",
      rows: rows,
    });
  
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${userSession.business_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${userSession.accessToken}`,
      },
      data : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "interactive",
        interactive: {
          type: "list",
          body: {
            text: message,
          },
          action: {
            button: "Select a mentor",
            sections: actionSections,
          },
        },
      }
    })
  }
  async function sendTextMessage(userPhoneNumber,message){
    const userSession = userSessions.get(userPhoneNumber);
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


  async function sendImagesMessage(message, url){
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.from,
        type: "image",
        image: {
          link: url,
          caption: message
        }
      }
    });
  }
  

async function sendButtonMessage(phoneNumber, message, nextNode) {
    const userSession = userSessions.get(phoneNumber);
    let button_rows=[];
    let buttons=nextNode;
  for(let i=0; i<buttons.length; i++){
    const buttonNode=buttons[i];
    console.log(buttonNode,buttons,nextNode,"hehehehehehehehheeh")
    button_rows.push({
      type: 'reply',
      reply :{
        id: userSession.flowData[buttonNode].id, 
        title:userSession.flowData[buttonNode].body
      }
    })
    console.log("button_row:" ,button_rows)
  }
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v18.0/${userSession.business_number_id}/messages`,
    headers: {
      Authorization: `Bearer ${userSession.accessToken}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body:{
          text: message
        },
        action:{
          buttons: button_rows
        }
      }
    }
  })
  }
  
  async function sendInputMessage(userPhoneNumber,message){
    const userSession = userSessions.get(userPhoneNumber);
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


  async function sendNodeMessage(userPhoneNumber) {
    console.log(`sendNodeMessage called for userPhoneNumber: ${userPhoneNumber}`);
    
    const userSession = userSessions.get(userPhoneNumber);
    if (!userSession) {
      console.error(`No session found for user ${userPhoneNumber}`);
      return;
    }
    console.log('User session retrieved:', userSession);
  
    const { flowData, adjList, currNode, accessToken } = userSession;
    const flow = flowData;
    const adjListParsed = adjList;
  
    console.log('Current Node:', currNode);
    console.log('Adjacency List:', adjListParsed);
  
    if (typeof currNode !== 'undefined' && currNode !== null && adjListParsed && adjListParsed[currNode]?.length > 0) {
      const nextNode = adjListParsed[currNode];
      const node_message = flow[currNode]?.body;
  
      console.log('Next Node:', nextNode);
      console.log('Node Message:', node_message);
  
      if (node_message) {
        io.emit('node-message', {
          message: node_message,
          phone_number_id: business_phone_number_id
        });
        console.log("Emitted node message:", node_message);
      }
  
      switch (flow[currNode]?.type) {
        case "Button":
          console.log(`Processing Button node for user ${userPhoneNumber}`);
          await sendButtonMessage(userPhoneNumber, node_message, nextNode);
          break;
  
        case "List":
          console.log(`Processing List node for user ${userPhoneNumber}`);
          await sendListMessage(userPhoneNumber, nextNode, node_message);
          break;
  
        case "Input":
          console.log(`Processing Input node for user ${userPhoneNumber}`);
          await sendInputMessage(userPhoneNumber, nextNode, node_message);
          break;
  
        case "string":
          console.log(`Processing String node for user ${userPhoneNumber}`);
          await sendTextMessage(userPhoneNumber, node_message);
          userSession.currNode = nextNode[0] || null;
          console.log(`Updated currNode to: ${userSession.currNode}`);
          break;
  
        case "image":
          console.log(`Processing Image node for user ${userPhoneNumber}`);
          await sendImagesMessage(userPhoneNumber, node_message, flow[currNode]?.body?.url);
          break;
  
        case "AI":
          console.log(`Processing AI node for user ${userPhoneNumber}`);
          await sendStringMessage(userPhoneNumber, node_message);
          userSession.AIMode = true;
          console.log('AI Mode enabled');
          break;
  
        default:
          console.log(`Unknown node type: ${flow[currNode]?.type}`);
      }
  
      userSession.nextNode = nextNode;
      userSessions.set(userPhoneNumber, userSession);
      console.log('Session updated with nextNode:', nextNode);
  
    } else {
      console.log('No valid currNode or adjacency list found, resetting session to start');
      userSession.currNode = 0;
      userSession.nextNode = adjListParsed[userSession.currNode] || [];
      userSessions.set(userPhoneNumber, userSession);
      console.log('Session reset to first node:', userSession);
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
          await sendTextMessage(formattedPhoneNumber, message, urlbool);
          break;

        case 'image':
          const { imageUrl, caption } = additionalData;
          await sendImagesMessage(formattedPhoneNumber,imageUrl,caption);
          break;

        case 'button':
          const { buttons } = additionalData;
          await sendButtonMessage(formattedPhoneNumber,message,buttons);
          break;

        case 'list':
          const { list } = additionalData;
          await sendListMessage(list, message);
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
      console.log("Webhook received:", JSON.stringify(req.body, null, 2));
  
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
      const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
      const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
      const userPhoneNumber = contact?.wa_id;
  
      console.log("Extracted data:", {
        business_phone_number_id,
        contact,
        message,
        userPhoneNumber
      });
  
      if (message) {
        console.log("Emitting new message event");
        io.emit('new-message', {
          message: message?.text?.body || message?.interactive?.body,
          phone_number_id: business_phone_number_id,
          contactPhone: contact
        });
      }
  
      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber);
      if (!userSession&&userPhoneNumber) {
        console.log(`Creating new session for user ${userPhoneNumber}`);
        try {
          const response = await axios.get(`http://127.0.0.1:8000/whatsapp_tenant?business_phone_id=${business_phone_number_id}`);
          console.log("Tenant data received:", response.data);
          const flowData = JSON.parse(response.data.flow_data);
          const adjList = JSON.parse(response.data.adj_list);
         const startNode=3;
          // Validate the data types
          if (!Array.isArray(flowData)) {
              throw new Error("flowData is not an array");
          }
          if (!Array.isArray(adjList) || !adjList.every(Array.isArray)) {
              throw new Error("adjList is not an array of arrays");
          }
          userSession = {
           
            flowData: JSON.parse(response.data.flow_data),
            adjList: JSON.parse(response.data.adj_list),
            accessToken: response.data.access_token,
            currNode: startNode,
            nextNode:adjList[startNode],
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
        console.log(`Existing session found for user ${userPhoneNumber}:`, userSession);
      }
  
      if (!AIMode) {
        console.log("Processing in non-AI mode");
        if (message?.type === "interactive") {
          console.log("Processing interactive message");
          let userSelectionID = message?.interactive?.button_reply?.id;
          let userSelection = message?.interactive?.button_reply?.title;
          console.log("User selection:", { userSelectionID, userSelection });
          try {
            userSession.nextNode.forEach(i => {
              console.log(`Checking node ${i}:`, userSession.flowData[i]);
              if (userSession.flowData[i].id == userSelectionID) {
                userSession.currNode = i;
                console.log("Matched node found. New currNode:", userSession.currNode);
                userSession.nextNode = userSession.adjList[userSession.currNode];
                console.log("Updated nextNode:", userSession.nextNode);
                userSession.currNode = userSession.nextNode[0];
                console.log("Final currNode:", userSession.currNode);
                console.log("Calling sendNodeMessage");
                sendNodeMessage(userPhoneNumber);
                
              }
            });
          } catch (error) {
            console.error('Error processing interactive message:', error);
          }
        }
        if (message?.type === "text") {
          console.log("Processing text message");
          if (userSession.currNode != 8) {
            console.log(`Storing input for node ${userSession.currNode}:`, message?.text?.body);
            //userSession.inputMap.set(userSession.currNode, message?.text?.body);
            //userSession.currNode = userSession.nextNode[0];
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
      }
  
      console.log("Webhook processing completed successfully");
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
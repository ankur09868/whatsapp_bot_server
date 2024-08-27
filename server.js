import express from "express";
import axios from "axios";
import { createServer } from "http";
import sendWhatsappMessage from './send_whatsapp_msg.js';
import get_result_from_query from "./get_result_from_query.js";
import addConversation from "./addConversation.js";
import response_from_gpt from "./response_from_gpt.js";
import handleFileUpload from "./handleFileUpload.js";
import { getdata } from './fromFirestore.js';
import { Server } from "socket.io";
import cors from 'cors';

const WEBHOOK_VERIFY_TOKEN = "COOL";
const GRAPH_API_TOKEN = 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P';
const PORT = 8080;

const conversationData = new Map();
const inputMap = new Map(); 

var AI_Replies = true;
var AIMode = false;

export { addConversation, conversationData };

var currNode = 0;
let zipName;
let prompt;
let lastMessage_id;
var count = 0;
let business_phone_number_id = 241683569037594;
var contact;
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



var adjList;
var flow;
app.post("/flowdata", async (req, res) => {
  adjList=req.body.adjacencyList;
  flow=req.body.nodes;
  console.log("rec data: ", req.body);


  res.status(200).json({ success: true, message: "flowdata sent successfully" });
})


async function sendImageMessage( message,business_phone_number_id, userSelection, zipName, prompt, imageUrl) {
  const result = await get_result_from_query(userSelection, zipName, prompt);
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
        link: imageUrl,
        caption: `${userSelection} image - ${result}`
      }
    }
  });
}


async function sendButtonMessage(buttons, message){
  let button_rows=[];
  for(let i=0; i<buttons.length; i++){
    const buttonNode=buttons[i];
    button_rows.push({
      type: 'reply',
      reply :{
        id: flow[buttonNode].id, 
        title: flow[buttonNode].body
      }
    })
    console.log("button_row:" ,button_rows)
  }
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.wa_id,
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

async function sendListMessage(list, message){
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
    url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`,
    },
    data : {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.wa_id,
      type: "interactive",
      interactive: {
        type: "list",
        body: {
          text: "Welcome to NurenAI, We offer AI Mentors you can engage with. Have a try!",
        },
        action: {
          button: "Select a mentor",
          sections: actionSections,
        },
      },
    }
  })
}

async function sendInputMessage(message){
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.wa_id,
      type: "text",
      text: {
        body: message
      }
    }
  });
}

async function sendStringMessage(message){
  
  await axios({
    method: "POST",
    url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
    headers: {
      Authorization: `Bearer ${GRAPH_API_TOKEN}`
    },
    data: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.wa_id,
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

async function sendAIMessage(message){

}

var nextNode;

async function sendNodeMessage(node){ //0
if(node==0 || nextNode.length !=0){
    nextNode=adjList[node];
  const node_message=flow[node].body;
  await addConversation(contact.wa_id, node_message, ".", contact?.profile?.name)
  if(node_message) {
    io.emit('node-message', {message: node_message,
      phone_number_id: business_phone_number_id}
     );
    console.log("test");
  }
  console.log("messagee " , node_message)
  if(flow[node].type === "button"){
    const buttons=nextNode;
    sendButtonMessage(buttons, node_message);
  }
  else if(flow[node].type === "list"){
    const list=nextNode;
    sendListMessage(list, node_message);
  }

  else if(flow[node].type === "Input"){
    sendStringMessage(node_message);

  }
  else if(flow[node].type === "string"){
    await sendStringMessage(node_message);
    currNode = nextNode[0]; console.log("currrrrrrrrrrrr ", flow[node])
    sendNodeMessage(currNode);
  }
  else if(flow[node].type === "image"){
    sendImagesMessage(node_message, flow[node].body?.url);
  }
  else if(flow[node].type === "AI"){
    sendStringMessage(node_message);
    AIMode=true;
    
  }
  
  console.log("messagee2 " ,node_message)
}
  else {
    currNode=0;
    nextNode=adjList[currNode];
  }
  
}

app.get("/get-map", async (req, res) =>{
  try{
    const key=req.query.phone;
    await getdata(conversationData);

    let list = conversationData.get(key);
      res.json({
      bot_replies: list[0],
      user_replies: list[1],
      contact:{
        contactName: list[2],
        phone_number: key
    }
  });
  res.send();
  } catch(error) {
    console.error('error: ', error);
    res.status(500).json({ error: "internal server error"})
  }
})

app.get("/get-contacts", async (req, res) =>{
  //console.log(1);
    // console.log(conversationData.keys())
  const data=Array.from(conversationData);
  // console.log(data);
  
  res.send(data);
})

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumbers, message } = req.body;
    const tenantId = req.headers['x-tenant-id'];
    // if(tenantId){
    //   const { access_token, business_phone_number_id } = getTenantDetails(tenantId)
    // }
    // else{
    //   res.status(400).send('Tenant ID missing')
    // }
    for (const phoneNumber of phoneNumbers) {
      const formattedPhoneNumber = `91${phoneNumber}`;
      await sendWhatsappMessage(formattedPhoneNumber, message);
    }
    
  
    res.status(200).json({ success: true, message: "Whatsapp message sent successfully" });
  } catch (error) {
    console.error("Error sending Whatsapp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send Whatsapp message" });
  }
});
app.patch("/toggleAiReplies", async(req,res) =>{
  try {
    AI_Replies = !AI_Replies;
    res.status(200).json({ success: true, message: "Task Done" });
  } catch (error) {
    console.error("Error sending Whatsapp message:", error.message);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

var flag =false;
app.post("/webhook", async (req, res) => {
  try {
    // Extracting values from the request body
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

    // Emit new message event
    if (message) {
      io.emit('new-message', {
        message: message?.text?.body || message?.interactive?.body,
        phone_number_id: business_phone_number_id,
        contactPhone: contact
      });
      console.log("Message emitted");
    }

    // Handle AIMode-related logic
    if (!AIMode) {
      if (message?.type === "interactive") {
        let userSelectionID = message?.interactive?.button_reply?.id;
        let userSelection = message?.interactive?.button_reply?.title;

        // Check if flow and adjList are defined
        if (Array.isArray(nextNode)) {
          console.log("userSelection:", userSelection);
          try {
            if (Array.isArray(flow) && Array.isArray(adjList)) {
              nextNode.forEach(i => {
                if (flow[i]?.id === userSelectionID) {
                  currNode = i;
                  console.log("currNode:", currNode);
                  nextNode = adjList[currNode] || [];
                  console.log("nextNode:", nextNode);
                  if (nextNode.length > 0) {
                    currNode = nextNode[0];
                    console.log("new currNode:", currNode);
                    sendNodeMessage(currNode);
                  } else {
                    console.error("nextNode is empty for currNode:", currNode);
                  }
                  return;
                }
              });
            } else {
              console.warn("flow or adjList is not properly defined");
            }
          } catch (error) {
            console.error('An error occurred while processing the next node:', error.message);
          }
        } else {
          console.warn("nextNode is not defined or not an array");
        }
      }

      if (message?.type === "text") {
        if (currNode !== 0) {
          inputMap.set(currNode, message?.text?.body);
          if (Array.isArray(nextNode) && nextNode.length > 0) {
            currNode = nextNode[0];
            sendNodeMessage(currNode);
          } else {
            console.warn("nextNode is not defined or empty");
          }
        }
      }
    }

    // Handle media messages
    if (message?.type === "image" || message?.type === "document" || message?.type === "video") {
      const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
      let mediaURL;

      // Get media/doc URL
      if (mediaID) {
        try {
          const response = await axios({
            method: "GET",
            url: `https://graph.facebook.com/v19.0/${mediaID}`,
            headers: {
              Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            },
          });
          mediaURL = response.data.url;
          console.log("Media URL:", mediaURL);

          // Retrieve media/doc
          if (mediaURL) {
            const document_file = await axios({
              method: "GET",
              url: mediaURL,
              headers: {
                Authorization: `Bearer ${GRAPH_API_TOKEN}`,
              },
            });
            console.log("Document file:", document_file);
            // Handle document upload if needed
            // handleFileUpload(document_file);
          } else {
            console.error("Media URL is not defined");
          }
        } catch (error) {
          console.error("Error retrieving media:", error);
        }
      } else {
        console.error("mediaID is not defined");
      }
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
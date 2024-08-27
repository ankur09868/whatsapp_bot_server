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
  try {
    let button_rows = buttons.map(buttonNode => ({
      type: 'reply',
      reply: {
        id: flow[buttonNode].id,
        title: flow[buttonNode].body
      }
    }));

    const response = await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.wa_id,
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
async function sendListMessage(list, message){
  const rows = list.map((listNode, index) => ({
    id: flow[listNode].id,
    title: flow[listNode].body
  }));

  const actionSections = [{ title: "Section Title", rows }];

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
          text: message,
        },
        action: {
          button: "Choose Option",
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
  if(flow[node].type === "Button"){
    const buttons=nextNode;
    sendButtonMessage(buttons, node_message);
  }
  else if(flow[node].type === "List"){
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
try{ 
  business_phone_number_id =req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  if (message) {
    io.emit('new-message', {
      message: message?.text?.body || message?.interactive?.body,
      phone_number_id: business_phone_number_id,
      contactPhone: contact
    });
  console.log("test");
  }

 if(!AIMode){
  if(message?.type==="interactive"){
    let userSelectionID = message?.interactive?.button_reply?.id;
    let userSelection = message?.interactive?.button_reply?.title; 
    await addConversation(contact.wa_id, ".", userSelection, "crm")
  // add buttons' reply as well
    console.log("userSelection:", userSelection)
    try {
      nextNode.forEach(i => {
        console.log("I: ", flow[i].id)
        if (flow[i].id == userSelectionID) {
          currNode = i;
          console.log("currNde: " ,currNode)
          nextNode = adjList[currNode];
          console.log("nextnode: ", nextNode)
          currNode = nextNode[0];
          console.log("currnode", currNode)
          sendNodeMessage(currNode);
          return;
        }
      });
    } catch (error) {
      console.log('An error occurred while processing the next node:', error.message);
      // Handle the error as needed, such as returning an error response or performing fallback logic.
    }
  }
  if(message?.type === "text"){
    await addConversation(contact.wa_id, ".", message?.text?.body, contact?.profile?.name);
    
    if(currNode!=0)
    {
      inputMap.set(currNode, message?.text?.body);
      currNode=nextNode[0];
    }
    sendNodeMessage(currNode);
 }
}
  

else {
  if (message?.type === "interactive") {
    let userSelection = message?.interactive?.list_reply?.title;
    addConversation(contact.wa_id, ".", userSelection, contact?.profile?.name);

    switch (userSelection) {
      case "Steve Jobs":
        await sendImageMessage(message, business_phone_number_id, userSelection, '1c16de68-d364-4dd2-bd47-7ad58bce3a60.zip', 'Reply in 10 words to an entrepreneur', 'https://cdn.glitch.global/6679f495-37ef-4b2c-977b-d95db7c797f0/Steve%20Jobs.jpg?v=1689619406365');
        break;
      case "Bob Marley":
        await sendImageMessage(message, business_phone_number_id, userSelection, 'c1f8c20e-b41a-4d3a-92d7-2302c0649f32.zip', 'Reply in 10 words to a musician', 'https://cdn.glitch.global/6679f495-37ef-4b2c-977b-d95db7c797f0/Bob%20Marley.jpg?v=1689619402060');
        break;
      case "Lionel Messi":
        await sendImageMessage(message, business_phone_number_id, userSelection, '4de17496-0465-44eb-816f-563e3c5bece6.zip', 'Reply in 10 words to a footballer', 'https://cdn.glitch.global/6679f495-37ef-4b2c-977b-d95db7c797f0/Lionel%20Messi.jpg?v=1689619405125');
        break;
    }

    AIMode = false;
  }
  if (message?.type === "text") {
    if (flow[currNode]?.type === "image") {
      zipName = flow[currNode]?.zipName;
      prompt = message?.text?.body;
      let keys = Array.from(inputMap.keys());

      if (keys.length > 0) {
        sendNodeMessage(keys[0]);
      }
    } else {
      sendNodeMessage(currNode);
    }
  }
} 

  if(message?.type=="image" || message?.type == "document" || message?.type == "video"){
      const mediaID=message?.image?.id || message?.document?.id || message?.video?.id;
      let mediaURL;
      
      //to get media/doc url
      await axios({
        method: "GET",
        url: `https://graph.facebook.com/v19.0/${mediaID}`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
      })
      .then(function (response) {
        mediaURL=response.data.url;
        // console.log(mediaURL);
      })
      .catch(function (error) {
        console.error("Error:", error);
      });
      
      
      //to retrieve media/doc
      let document_file;
      await axios({
        method: "GET",
        url: mediaURL,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
      })
      .then(function (response) {
        document_file = response;
        console.log(document_file);
      })
      .catch(function (error) {
        console.error("Error:", error);
      });
      //upload document
      // handleFileUpload(document_file);
    }

  res.sendStatus(200);
 }
  catch (error) {
    console.error("Error in webhook handler:", error);
    res.sendStatus(500);
  }
  })

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

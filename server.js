import express from "express";
import axios from "axios";
import { createServer } from "http";
//import { Server } from "socket.io";
import sendWhatsappMessage from './send_whatsapp_msg.js';
import get_result_from_query from "./get_result_from_query.js";
import addConversation from "./addConversation.js";

import handleFileUpload from "./handleFileUpload.js";
import {getdata} from './fromFirestore.js';
//import flow from './flow';
import e from "express";

const WEBHOOK_VERIFY_TOKEN = "COOL";
const GRAPH_API_TOKEN= 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P';
const PORT = 8080;


const conversationData = new Map();

const inputMap=new Map(); 

var AI_Replies=true;
var AIMode=false;

export { addConversation, conversationData };

var currNode=4;
let zipName;
let prompt;
let lastMessage_id;
var count=0;
let business_phone_number_id=241683569037594;
var contact;
const app = express();
const httpServer = createServer(app);

const server = app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});


app.use(express.json());

const allowedOrigins =['http://localhost:8080', 'http://localhost::5173/']

app.use((req, res, next) =>{
  //req.header('Access-Control-Allow-Origin', 'https://localhost:5173')
  const origin = req.headers.origin;
  if(allowedOrigins.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  //res.header('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.header(
    'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS, PATCH'
  );
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

var nextNode;

async function sendNodeMessage(node){ //0
if(node==4 || nextNode.length !=0){
    nextNode=adjList[node];
  const node_message=flow[node].body;
  console.log("NODE : " ,node)
  await addConversation(contact.wa_id, node_message, ".", contact?.profile?.name)

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
    currNode=4;
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
    const { phoneNumber , message } = req.body;
    
    await sendWhatsappMessage(phoneNumber, message);
  
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
  business_phone_number_id =req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  // log incoming messages
  //console.log(contact);
  //console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));
    
/* if(message) {
   io.emit('new-message', {message: message?.text?.body || message?.interactive?.body} );
   console.log("test");
 }*/

 if(!AIMode){
  if(message?.type==="interactive"){
    let userSelectionID = message?.interactive?.button_reply?.id;
    let userSelection = message?.interactive?.button_reply?.title; 
    await addConversation(contact.wa_id, ".", userSelection, contact?.profile?.name)
  // add buttons' reply as well
    console.log("userSelection:", userSelection)
    nextNode.forEach(i => {
      if(flow[i].id == userSelectionID){
        currNode = i;
        nextNode = adjList[currNode];
        currNode = nextNode[0];
        sendNodeMessage(currNode);
        return;
      }
    })
    }
  if(message?.type === "text"){
    await addConversation(contact.wa_id, ".", message?.text?.body, contact?.profile?.name);
    
    if(currNode!=4)
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
      // Handle the Quick Reply selection
      //console.log(`User selected Quick Reply: ${userSelection}`);

      if(contact!=undefined){
      addConversation(contact.wa_id, ".", userSelection, contact?.profile?.name);
      //console.log(conversationData);
      //console.log(conversationData);conv_id: 55fcd3f3e4a99b6721aa3020389e6814, context_id: HBgMOTE5NTQ4MjY1OTA0FQIAERgSRDU3QjBCNzJCNTdGMThFRTVCAA==
      }

      switch (userSelection) {
          case "Steve Jobs":
            await sendImageMessage( message,business_phone_number_id,userSelection, '1c16de68-d364-4dd2-bd47-7ad58bce3a60.zip', 'Reply in 10 words to an entrepreneur', 'https://cdn.glitch.global/6679f336-a886-492a-986b-13725a22211f/stevejobs.jpg?v=1712641030840', 'Steve Jobs image');
            zipName='1c16de68-d364-4dd2-bd47-7ad58bce3a60.zip'
            prompt='Reply in 10 words to an entrepreneur'
            break;
          case "Krishna":
            await sendImageMessage( message,business_phone_number_id,userSelection, '11055e45-85e8-49c7-ab5c-f160d1733d88.zip', 'Reply in 10 words to your disciple', 'https://cdn.glitch.global/6679f336-a886-492a-986b-13725a22211f/krishna.jpg?v=1712641000989', 'Krishna image');
            zipName = "11055e45-85e8-49c7-ab5c-f160d1733d88.zip"
            prompt = "Reply in 10 words to your disciple"
            break;
          case "Nietzsche":
            await sendImageMessage( message,business_phone_number_id,userSelection, '03101274-9092-472a-8c0c-89295c0c2c0c.zip', 'You are Zarathustra.Reply in 10 words to your student', 'https://cdn.glitch.global/6679f336-a886-492a-986b-13725a22211f/Nietzsche187a.jpg?v=1712640987663', 'Nietzsche image');
            zipName = '03101274-9092-472a-8c0c-89295c0c2c0c.zip'
            prompt = 'You are Zarathustra.Reply in 10 words to your student'
            break;
          case "Newton":
            await sendImageMessage( message,business_phone_number_id,userSelection, '5af3a21b-6a1b-4caa-95fb-9a3387130960.zip', 'Reply in 10 words to a science student', 'https://cdn.glitch.global/6679f336-a886-492a-986b-13725a22211f/newton.jpg?v=1712640978036', 'Newton image');
            zipName = '5af3a21b-6a1b-4caa-95fb-9a3387130960.zip'
            prompt = 'Reply in 10 words to a science student'
            break;
          case "Napolean":
            await sendImageMessage( message,business_phone_number_id,userSelection, '26623868-69c1-49cf-be37-4344eea7a688.zip', 'Reply in 10 words like you were a mentor', 'https://cdn.glitch.global/6679f336-a886-492a-986b-13725a22211f/napolean.jpeg?v=1712641019273', 'Napolean image');
            zipName = '26623868-69c1-49cf-be37-4344eea7a688.zip'
            prompt = 'Reply in 10 words like you were a mentor'
            break;
      }
      addConversation(contact.wa_id, `${userSelection} image`, ".", contact?.profile?.name);
      // console.log(conversationData);
      }
    if (message?.type === "text") {

    if(contact!=undefined){

      console.log("Entered ai mode: ", contact.wa_id);
      addConversation(contact.wa_id, ".", message?.text?.body, contact?.profile?.name);
      //console.log(conversationData);
      //console.log(conversationData);conv_id: 55fcd3f3e4a99b6721aa3020389e6814, context_id: HBgMOTE5NTQ4MjY1OTA0FQIAERgSRDU3QjBCNzJCNTdGMThFRTVCAA==
    }

      
      if(AI_Replies){
      const body=message?.text?.body;

      if((await response_from_gpt(body, "arrival"))=="Yes" || (await response_from_gpt(body, "change"))=="Yes"){
        await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.from,
          type: "interactive",
          interactive: {
            type: "list",
            header: {
              type: "text",
              text: `Greetings! ${contact.profile.name}`,
            },
            body: {
              text: "Welcome to NurenAI, We offer AI Mentors you can engage with. Have a try!",
            },
            action: {
              button: "Select a mentor",
              sections: [
                {
                  title: "Section Title",
                  rows: [
                    {
                      id: "row-1",
                      title: "Steve Jobs",
                    },
                    {
                      id: "row-2",
                      title: "Krishna",
                    },
                    {
                      id: "row-3",
                      title: "Nietzsche",
                    },
                    {
                      id: "row-4",
                      title: "Newton",
                    },
                    {
                      id: "row-5",
                      title: "Napolean",
                    },
                  ],
                },
              ],
            },
          },
        },
      });
      addConversation(contact.wa_id, "Welcome Message", ".", contact?.profile?.name);
        
        
        // console.log(conversationData);
      }
      else if(await response_from_gpt(body, "departure")=="Yes"){
        await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers:{
          Authorization: `Bearer ${GRAPH_API_TOKEN}`
        },

        data:{
          messaging_product:"whatsapp",
          recipient_type:"individual",
          to:message.from,
          type:"text",
          text:{
            body: "Goodbye!"
          }
        }
      })
        addConversation(contact.wa_id, "Goodbye!", ".", contact?.profile?.name);
        
      }
      else{
        console.log("zip: ",body);
        const result=await get_result_from_query(body, zipName, prompt);

          await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers:{
          Authorization: `Bearer ${GRAPH_API_TOKEN}`
        },

        data:{
          messaging_product:"whatsapp",
          recipient_type:"individual",
          to:message.from,
          type:"text",
          text:{
            body: result,
          }
        }


      })
        addConversation(contact.wa_id, result, ".", contact?.profile?.name);
      }


      //console.log(conversationData);


      // mark incoming message as read
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        headers: {
          Authorization: `Bearer ${GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          status: "read",
          message_id: message.id,
        },
      });
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
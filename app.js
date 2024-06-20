import express from "express";
import axios from "axios";
import { createServer } from "http";
//import get_result_from_query from "./get_result_from_query.js";
//import handleFileUpload from "./handleFileUpload.js";

import 'firebase/compat/firestore';


import firebase from 'firebase/compat/app';

import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBPsLD_NgSwchMrpG2U81UsH_USQGSiNZU',
  authDomain: 'nurenai.firebaseapp.com',
  projectId: 'nurenai',
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// Example function to retrieve data from Firestore
async function getdata(dataMap) {
  try {
    const docRef = db.collection('whatsapp');
    const docSnapshot = await docRef.get();
    docSnapshot.forEach(doc => {
      const data=doc.data();
      const user_replies=data.user_replies;
      const bot_replies=data.bot_replies;
      const name=data.name;
      dataMap.set(doc.id, [user_replies, bot_replies, name]);
    })
    //console.log(dataMap);
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
}

async function setdata(key, bot_replies, user_replies, name){
    const kroData = {
        bot_replies: bot_replies,
        user_replies :user_replies,
        name : name
    }

    return db.collection('whatsapp').doc(key).set(kroData).then(() => 
    console.log("new data set into firebase."));
}


const WEBHOOK_VERIFY_TOKEN = "COOL";
const GRAPH_API_TOKEN = 'YOUR_GRAPH_API_TOKEN';
const PORT = 5173;
const business_phone_number_id = 241683569037594;

let conversationData = new Map();
let inputMap = new Map();
let AI_Replies = true;
let AIMode = false;
let currNode = 4;
let zipName;
let prompt;
let contact;
let nextNode;
let adjList;
let flow;

const app = express();
const httpServer = createServer(app);

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
app.use(express.json());

const allowedOrigins = ['*'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  next();
});

app.post("/flowdata", async (req, res) => {
  adjList = req.body.adjacencyList;
  flow = req.body.nodes;
  console.log("Received data: ", req.body);
  res.status(200).json({ success: true, message: "Flow data sent successfully" });
});

async function sendImageMessage(message, business_phone_number_id, userSelection, zipName, prompt, imageUrl) {
  const result = "yes";
  await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: message.from,
    type: "image",
    image: {
      link: imageUrl,
      caption: `${userSelection} image - ${result}`
    }
  }, {
    headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
  });
}

async function sendButtonMessage(buttons, message) {
  let button_rows = buttons.map(buttonNode => ({
    type: 'reply',
    reply: {
      id: flow[buttonNode].id,
      title: flow[buttonNode].body
    }
  }));

  await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
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
}

async function sendListMessage(list, message) {
  const rows = list.map((listNode, index) => ({
    id: `list-${index + 1}`,
    title: flow[listNode].body
  }));

  const actionSections = [{ title: "Section Title", rows }];

  await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: contact.wa_id,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: message },
      action: {
        button: "Select a mentor",
        sections: actionSections
      }
    }
  }, {
    headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
  });
}

async function sendStringMessage(message) {
  await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: contact.wa_id,
    type: "text",
    text: { body: message }
  }, {
    headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
  });
}

async function sendImagesMessage(message, url) {
  await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: message.from,
    type: "image",
    image: {
      link: url,
      caption: message
    }
  }, {
    headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
  });
}

async function sendNodeMessage(node) {
  if (node === 4 || nextNode.length !== 0) {
    nextNode = adjList[node];
    const node_message = flow[node].body;

    await addConversation(contact.wa_id, node_message, ".", contact?.profile?.name);

    if (flow[node].type === "button") {
      const buttons = nextNode;
      sendButtonMessage(buttons, node_message);
    } else if (flow[node].type === "list") {
      const list = nextNode;
      sendListMessage(list, node_message);
    } else if (flow[node].type === "Input") {
      sendStringMessage(node_message);
    } else if (flow[node].type === "string") {
      await sendStringMessage(node_message);
      currNode = nextNode[0];
      sendNodeMessage(currNode);
    } else if (flow[node].type === "image") {
      sendImagesMessage(node_message, flow[node].body?.url);
    } else if (flow[node].type === "AI") {
      sendStringMessage(node_message);
      AIMode = true;
    }
  } else {
    currNode = 4;
    nextNode = adjList[currNode];
  }
}

app.get("/get-map", async (req, res) => {
  try {
    const key = req.query.phone;
    await getdata(conversationData);
    let list = conversationData.get(key);
    res.json({
      bot_replies: list[0],
      user_replies: list[1],
      contact: {
        contactName: list[2],
        phone_number: key
      }
    });
    res.send();
  } catch (error) {
    console.error('error: ', error);
    res.status(500).json({ error: "internal server error" });
  }
});

app.get("/get-contacts", async (req, res) => {
  const data = Array.from(conversationData);
  res.send(data);
});

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    await sendWhatsappMessage(phoneNumber, message);
    res.status(200).json({ success: true, message: "Whatsapp message sent successfully" });
  } catch (error) {
    console.error("Error sending Whatsapp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send Whatsapp message" });
  }
});

app.patch("/toggleAiReplies", async (req, res) => {
  try {
    AI_Replies = !AI_Replies;
    res.status(200).json({ success: true, message: "Task Done" });
  } catch (error) {
    console.error("Error sending Whatsapp message:", error.message);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

app.post("/webhook", async (req, res) => {
  business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  if (!AIMode) {
    if (message?.type === "interactive") {
      let userSelectionID = message?.interactive?.button_reply?.id;
      let userSelection = message?.interactive?.button_reply?.title;
      await addConversation(contact.wa_id, ".", userSelection, contact?.profile?.name);

      nextNode.forEach(i => {
        if (flow[i].id === userSelectionID) {
          currNode = i;
          nextNode = adjList[currNode];
          currNode = nextNode[0];
          sendNodeMessage(currNode);
          return;
        }
      });
    }

    if (message?.type === "text") {
      await addConversation(contact.wa_id, ".", message?.text?.body, contact?.profile?.name);

      if (currNode !== 4) {
        inputMap.set(currNode, message?.text?.body);
        currNode = nextNode[0];
      }
      sendNodeMessage(currNode);
    }
  } else {
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

  setdata(conversationData);
  res.sendStatus(200);
});

app.get("/webhook", (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/*app.post("/upload", async (req, res) => {
  handleFileUpload(req, res);
});*/

async function addConversation(key, botReply, userReply, userName) {
  const conversations = conversationData.get(key) || [[], [], userName];
  if (botReply !== '.') conversations[0].push(botReply);
  if (userReply !== '.') conversations[1].push(userReply);
  conversationData.set(key, conversations);
}

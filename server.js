import express from "express";
import axios from "axios";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import { getAccessToken, getPhoneNumberID, getWabaID } from "./login-flow.js";
import { sendNodeMessage, getFlow } from "./sendNodeMessage.js";


const WEBHOOK_VERIFY_TOKEN = "COOL";
const GRAPH_API_TOKEN = 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P';
const PORT = 8080;

const conversationData = new Map();
const inputMap = new Map();

var AI_Replies = true;
var AIMode = false;

var currNode = 8;
let business_phone_number_id = 241683569037594;
export var contact;
const app = express();
const httpServer = createServer(app);
app.use(cors());

export {business_phone_number_id, GRAPH_API_TOKEN}
export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'https://69af-14-142-75-54.ngrok-free.app', 'https://whatsappbotserver.azurewebsites.net'],
    methods: ['GET', 'POST']
  }
});

// httpServer.listen(PORT, () => {
//   console.log(`Server is listening on port: ${PORT}`);
// });

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



async function sendWhatsappMessage(phoneNumber, message, broadcastMessageID) {
  try {
    const response = await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "text",
      text: { body: message }
    }, {
      headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
    });
    var messageID = response?.data?.messages?.[0].id
    console.log('Message sent successfully:', response.data);
    const status_response = await axios.post('http://localhost:8000/set-status',{
      business_phone_number_id: business_phone_number_id,
      message_id : messageID,
      user_phone : phoneNumber,
      is_read: false,
      is_sent : false,
      is_delievered : false
    },{
      headers: {
        "X-Tenant-Id": "ll"
      }
    })
    console.log("Status Set Successfully: ", status_response.data);
  } catch (error) {
    console.error('Failed to send message:', error.response ? error.response.data : error.message);
  }
}

async function updateStatus(status, message_id, business_phone_number_id, user_phone) {
  let isRead = false;
  let isDelivered = false;
  let isSent = false;

  try {
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

    await axios.post("http://localhost:8000/set-status/", {
      business_phone_number_id: business_phone_number_id,
      is_read: isRead,
      is_delivered: isDelivered,
      is_sent: isSent,
      user_phone: user_phone,
      message_id: message_id
    },{
      headers: {"X-Tenant-Id": "ll"}
    });
  } catch (error) {
    console.error("Error updating status:", error);
  }
}

app.get("/get-map", async (req, res) =>{
  try{
    const key=req.query.phone;
    // await getdata(conversationData);

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
    
    const broadcastMessageID = new Set()

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
      await sendWhatsappMessage(formattedPhoneNumber, message,  broadcastMessageID);
    }
    console.log(broadcastMessageID)
    
  
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

export {flow, adjList, currNode, AIMode};

const processedMessages = new Set();

app.post("/webhook", async (req, res) => {
  console.log("Webhook payload:", JSON.stringify(req.body, null, 2));

  try {

    business_phone_number_id = req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    contact = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const messageID = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;
    if (processedMessages.has(messageID)) return res.sendStatus(200);

    processedMessages.add(messageID);
    res.sendStatus(200);

    // const status = req.body.entry?.[0]?.changes?.[0].value?.statuses
    // console.log("status: ", req.body.entry?.[0]?.changes?.[0].value?.statuses)
    // await updateStatus(status, messageID, business_phone_number_id, contact?.wa_id);
    
    if (contact) {
      try {
        const data = await getFlow(contact.wa_id);
        flow = data.nodes;
        adjList = data.adj_list;
        currNode = data.curr_node;
        var nextNode = adjList[currNode];
        AIMode = data.ai_mode;
      } catch (error) {
        console.error('Failed to get flow data:', error.message);
        res.sendStatus(500);
        return;
      }
    }

    if (message) {
      io.emit('new-message', {
        message: message?.text?.body || message?.interactive?.body,
        phone_number_id: business_phone_number_id,
        contactPhone: contact,
      });
      console.log("Message emitted");
    }

    if (!AIMode) {
      if (message?.type === "interactive") {
        let userSelectionID = message?.interactive?.button_reply?.id;
        let userSelection = message?.interactive?.button_reply?.title;
        console.log("User Selection:", userSelection);

        try {
          for (const i of nextNode) {
            console.log("Node ID:", flow[i].id);
            if (flow[i].id == userSelectionID) {
              currNode = i;
              console.log("Current Node:", currNode);
              nextNode = adjList[currNode];
              console.log("Next Node:", nextNode);
              currNode = nextNode[0];
              console.log("Updated Current Node:", currNode);
              await sendNodeMessage(currNode);
              return;
            }
          }
        } catch (error) {
          console.error('Error processing the next node:', error.message);
        }
      }

      if (message?.type === "text") {
        try {
          if (currNode != 8) {
            inputMap.set(currNode, message?.text?.body);
            currNode = nextNode[0];
          }
          await sendNodeMessage(currNode);
        } catch (error) {
          console.error('Error sending node message:', error.message);
        }
      }
    } else {
      if (message?.type === "interactive") {
        try {
          let userSelection = message?.interactive?.list_reply?.title;
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
        } catch (error) {
          console.error('Error sending image message:', error.message);
        }
      }

      if (message?.type === "text") {
        try {
          if (flow[currNode]?.type === "image") {
            zipName = flow[currNode]?.zipName;
            prompt = message?.text?.body;
            let keys = Array.from(inputMap.keys());

            if (keys.length > 0) {
              await sendNodeMessage(keys[0]);
            }
          } else {
            await sendNodeMessage(currNode);
          }
        } catch (error) {
          console.error('Error sending node message:', error.message);
        }
      }
    }

    if (["image", "document", "video"].includes(message?.type)) {
      try {
        const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
        let mediaURL;

        if (mediaID) {
          try {
            const response = await axios.get(`https://graph.facebook.com/v19.0/${mediaID}`, {
              headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` },
            });
            mediaURL = response.data.url;
            console.log("Media URL:", mediaURL);

            if (mediaURL) {
              const document_file = await axios.get(mediaURL, {
                headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` },
              });
              console.log("Document file retrieved");
              
            } else {
              console.error("Media URL is not defined");
            }
          } catch (error) {
            console.error("Error retrieving media:", error.message);
          }
        } else {
          console.error("mediaID is not defined");
        }
      } catch (error) {
        console.error('Error processing media:', error.message);
      }
    }

  } catch (error) {
    console.error("Error in webhook handler:", error.message);
  }
  nextNode=[]
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


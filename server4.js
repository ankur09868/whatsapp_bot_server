import express from "express";
import axios from "axios";
import { createServer } from "http";
import sendWhatsappMessage from './send_whatsapp_msg.js';
const PORT = 8080;


import { Server } from "socket.io";
import cors from 'cors';
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

const userSessions = new Map(); // To store user sessions
function sendNodeMessage(userSession, userPhoneNumber, io) {
    const currNode = userSession.currNode;
    const flowData = userSession.flowData;
  
    // Get the message for the current node
    const currentNodeData = flowData[currNode];
    if (currentNodeData) {
      // Send the message to the user
      io.emit('send-message', {
        phone_number_id: userSession.phone_number_id,
        message: currentNodeData.body,
        userPhoneNumber: userPhoneNumber
      });
    }
  }
  
app.post("/webhook", async (req, res) => {
    try {
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
      const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
      const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
      const userPhoneNumber = contact?.wa_id;
  
      // Retrieve or create user session
      let userSession = userSessions.get(userPhoneNumber);
      if (!userSession) {
        const response = await axios.get(`http://127.0.0.1:8000/whatsapp_tenant?business_phone_id=${business_phone_number_id}`);
        
        // Parse flow_data and adj_list as JSON
        const flowData = JSON.parse(response.data.flow_data);
        const adjList = JSON.parse(response.data.adj_list);
  
        userSession = {
          flowData: flowData,
          adjList: adjList,
          accessToken: response.data.access_token,
          currNode: 0, // Start at the first node
          inputMap: new Map()
        };
        userSessions.set(userPhoneNumber, userSession);
      }
  
      // Process user message and advance in the flow
      if (message) {
        const userInput = message.text?.body; // Adjust this based on your message type
        const currNode = userSession.currNode;
        const adjList = userSession.adjList;
  
        // Handle user input and decide the next node
        const nextNodes = adjList[currNode];
        if (nextNodes && nextNodes.length > 0) {
          // Move to the next node
          userSession.currNode = nextNodes[0]; // Here you can add logic to choose the appropriate next node
          userSessions.set(userPhoneNumber, userSession);
  
          // Send the message for the new current node
          sendNodeMessage(userSession, userPhoneNumber, io);
        } else {
          console.log("End of flow or no next nodes found.");
        }
      }
  
      res.sendStatus(200);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).send("An error occurred");
    }
  });

async function sendWhatsAppMessage(business_phone_number_id, message,access_token,userPhoneNumber) {
  try {
    await axios.post(`https://graph.facebook.com/v13.0/${business_phone_number_id}/messages`, {
      messaging_product: "whatsapp",
      to: userPhoneNumber,
      text: { body: message }
    }, {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    console.log(`Message sent to ${userPhoneNumber}: ${message}`);
  } catch (error) {
    console.error(`Error sending message to ${userPhoneNumber}:`, error);
  }
}

import express from "express";
import axios from "axios";
import NodeCache from 'node-cache';
import cors from 'cors';
import session from "express-session";
import crypto from "crypto";
import dotenv from "dotenv"
import { createServer } from "http";
import { Server } from "socket.io";

import { decryptRequest, encryptResponse, FlowEndpointException } from "./flowsAPI/encryption.js";
import { getNextScreen } from "./flowsAPI/flow.js";
import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister, addKey } from "./helpers/login-flow.js";
import { sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, fastURL, djangoURL} from "./snm.js"
import { updateStatus, updateLastSeen, getIndianCurrentTime } from "./helpers/misc.js"
import { Worker } from "worker_threads"
import { messageQueue } from "./queues/workerQueues.js";
import { nuren_users } from "./helpers/order.js"; 
import { businessWebhook } from "./webhooks/businessWebhook.js";
import { userWebhook } from "./webhooks/userWebhook.js";
import { manualWebhook, testWebhook } from "./webhooks/manualWebhook.js";
import { campaignWebhook, startCampaign, readData } from "./webhooks/campaignWebhook.js";


export const messageCache = new NodeCache({ stdTTL: 600 });
dotenv.config()
const WEBHOOK_VERIFY_TOKEN = "COOL";
const PORT = 8080;
const app = express();
const httpServer = createServer(app);
const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'];

export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'],
    methods: ['GET', 'POST']
  }
});

export let userSessions = new Map();
export const nurenConsumerMap = {}

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});


app.use(
  express.json({
    // store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);

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

app.post("/sendMessage", async (req, res) => {
  const { message, phone } = req.body;
  const business_phone_number_id = 536251836232437;
  const access_token = "EAAVZBobCt7AcBO3wIFi4f1T5viNWnWVMNEYZB6fa0J4LymWmjlCUZCgWiWUyzM0puxnhWJiHZAZAeqvaY0zSJAj4PZAdUNmo6kwfHL4ZCAqvW8TVR1RFk5ZBx8zmpdul1sZBaw8Cl9Jd6aEnFhXvgZAIu3ABefjTlYJ9RipOQdfCNpWu6WDYG2mTH3Q4X7ZBk9VFlJ9ocGnSRxlh7ipRQIn9JrcFqFS5FjiDAESNLSaJpDu5XAfxWtn1KaN5afZA2ZAUH";
  const tenant_id = 'qqeeusz';

  try {
    await sendTextMessage(phone, business_phone_number_id, message, access_token, tenant_id);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.post("/send-message", async (req, res) => {
  try {
    const { phoneNumbers, message, url, messageType, additionalData, business_phone_number_id, bg_id } = req.body;
    const tenant_id = req.headers['x-tenant-id'];
    const sendPromises = phoneNumbers.map(async (phoneNumber) => {
      
      const formattedPhoneNumber = phoneNumber.length === 10 ? `91${phoneNumber}` : phoneNumber;
      const cacheKey = `${business_phone_number_id}`;
      
      let access_token = messageCache.get(cacheKey);
      if (!access_token) {
        try {
          const tenantRes = await axios.get(`${fastURL}/whatsapp_tenant/`, {
            headers: { 'X-Tenant-Id': tenant_id }
          });
          access_token = tenantRes.data.whatsapp_data[0].access_token;
          messageCache.set(cacheKey, access_token);
        } catch (error) {
          console.error(`Error fetching tenant data for user ${business_phone_number_id}:`, error);
          throw error;
        }
      }

      const messageHandlers = {
        text: () => sendTextMessage(formattedPhoneNumber, business_phone_number_id, message, access_token, tenant_id),
        image: () => {
          const { imageId, caption } = additionalData;
          console.log(`image ID: ${imageId}, caption: ${caption}`);
          return sendImageMessage(formattedPhoneNumber, business_phone_number_id, imageId, caption, access_token, tenant_id);
        },
        audio: () => {
          const { audioID } = additionalData;
          return sendAudioMessage(formattedPhoneNumber, business_phone_number_id, audioID, access_token, tenant_id);
        },
        video: () => {
          const { videoID } = additionalData;
          return sendVideoMessage(formattedPhoneNumber, business_phone_number_id, videoID, access_token, tenant_id);
        },
        location: () => sendLocationMessage(formattedPhoneNumber, business_phone_number_id, additionalData, access_token, tenant_id)
      };

      if (!messageHandlers[messageType]) {
        throw new Error("Invalid message type");
      }

      const response = await messageHandlers[messageType]();
      const messageID = response.data?.messages[0]?.id;

      return { phoneNumber: formattedPhoneNumber, messageID, success: true };
    });

    const results = await Promise.all(sendPromises);
    res.json({ results });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.post("/use-worker", async (req, res) => {
  const worker = new Worker('./worker2.js', {workerData: req.body});
worker.on('message', (result) => {
console.log('square of 5 is :', result);
})
worker.on("error", (msg) => {
    console.log(msg);
 });
console.log('hurreyy')
})

app.post("/send-template", async (req, res) => {
  const { bg_id, bg_name, template, business_phone_number_id, phoneNumbers } = req.body;
  // const tenant_id = req.headers["x-tenant-id"];
  console.log("rcvd data: ", req.body)
  const templateName = template.name;
  const otp = template?.otp;

try {
    let responseData = messageCache.get(business_phone_number_id);

    // Fetch tenant data if not available in cache
    if (!responseData) {
      try {
        const response = await axios.get(`${fastURL}/whatsapp_tenant`, {
          headers: { bpid: business_phone_number_id },
        });
        responseData = response.data;
        messageCache.set(business_phone_number_id, responseData);
      } catch (error) {
        console.error(`Error fetching tenant data: ${error.message}`);
        throw new Error("Failed to fetch tenant data.");
      }
    }

    const access_token = responseData?.whatsapp_data[0]?.access_token;
    const account_id = responseData?.whatsapp_data[0]?.business_account_id;
    const tenant_id = responseData?.whatsapp_data[0]?.tenant_id

    if (!access_token || !account_id) {
      throw new Error("Invalid tenant data. Missing access token or account ID.");
    }

    const cacheKey = `${account_id}_${templateName}`;
    let graphResponse = messageCache.get(cacheKey);

    // Fetch template data if not available in cache
    if (!graphResponse) {
      try {
        const response = await axios.get(
          `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
          {headers: { Authorization: `Bearer ${access_token}` }}
        );
        graphResponse = response.data;
        messageCache.set(cacheKey, graphResponse);
      } catch (error) {
        console.error(`Error fetching template: ${error.message}`);
        throw new Error("Failed to fetch template data from the API.");
      }
    }

    if (!graphResponse?.data || graphResponse.data.length === 0) {
      throw new Error("Template not found.");
    }

    const templateData = graphResponse.data[0];
    
    const jobData = {
      bg_id,
      bg_name,
      templateData,
      business_phone_number_id,
      access_token,
      otp,
      tenant_id,
      phoneNumbers, // Send all phone numbers to the worker
      batchSize: 80, // Set batch size for worker
    };
    console.log("Sending data to messageQueue")

    try {
      await messageQueue.add('message', jobData);
    } catch (error) {
      console.error("Error adding job to queue:", error.message);
      res.status(500).json({ success: false, error: "Failed to enqueue message." });
      return;
    }
    
    // Log the results of message sending
    // console.log("Message Sending Results:", JSON.stringify(results, null, 2));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    res.status(500).json({ success: false, error: "Failed to send WhatsApp message." });
  }

});

async function sendCampaign(campaignData, access_token, tenant_id, account_id, bpid){
  console.log("Req rcvd in sendCampaign: ", campaignData, access_token, account_id, tenant_id, bpid)
}

async function sendTemplate(templateData, access_token, tenant_id, account_id, bpid) {
  console.log("Req rcvd in sendTemplate: ", templateData, access_token, account_id, tenant_id, bpid)
}

async function sendTemplateToGroup(groupData, access_token, tenant_id, account_id, bpid) {
  console.log("Req rcvd in sendTempateToGroup: ", groupData, access_token, account_id, tenant_id, bpid)
}

// app.post("/send-template", async (req, res) => {
//   const type = req.body.type;
//   const bpid = req.headers['business_phone_number_id'];

//   try {
//     let responseData = messageCache.get(bpid);
//     if (!responseData) {
//       const response = await axios.get(`${fastURL}/whatsapp_tenant/`, {
//         headers: { 'bpid': bpid }
//       });

//       responseData = response.data; 
//       messageCache.set(bpid, responseData);
//     }

//     const whatsappData = responseData.whatsapp_data?.[0];
//     if (!whatsappData) {
//       return res.status(400).send({ status: 400, message: "Invalid WhatsApp data." });
//     }

//     const { access_token, tenant_id, business_account_id: account_id } = whatsappData;

//     const handleType = {
//       campaign: () => {
//         const campaignData = req.body?.campaign;
//         if (!campaignData) {
//           return res.status(400).send({ status: 400, message: "Campaign data not found in request" });
//         }
//         sendCampaign(campaignData, access_token, tenant_id, account_id, bpid);
//         return res.sendStatus(200);
//       },
//       template: () => {
//         const templateData = req.body?.template;
//         if (!templateData) {
//           return res.status(400).send({ status: 400, message: "Template data not found in request" });
//         }
//         sendTemplate(templateData, access_token, tenant_id, account_id, bpid);
//         return res.sendStatus(200);
//       },
//       group: () => {
//         const groupData = req.body?.group;
//         if (!groupData) {
//           return res.status(400).send({ status: 400, message: "Group data not found in request" });
//         }
//         sendTemplateToGroup(groupData, access_token, tenant_id, account_id, bpid);
//         return res.sendStatus(200);
//       }
//     };

//     if (handleType[type]) {
//       return handleType[type]();
//     } else {
//       return res.status(400).send({ status: 400, message: "Invalid type specified in request" });
//     }
//   } catch (error) {
//     console.error("Error in /send-template:", error.message);
//     res.status(500).send({ status: 500, message: "Internal server error" });
//   }
// });


app.post("/reset-session", async (req, res) => {
  const bpid = req.body.business_phone_number_id;
  try {
    for (let key of userSessions.keys()) {
      if (key.includes(bpid)) {
        userSessions.delete(key);
        messageCache.del(bpid);
      }
    }
    console.log("User Sessions after delete: ", userSessions, messageCache)
    // console.log("Message Cache after delete: ", messageCache)
    res.status(200).json({ "Success": `Session Deleted Successfully for ${bpid}` });

  } catch (error) {
    console.log(`Error Occurred while resetting session for ${bpid}: `, error);

    res.status(500).json({ "Error": `Error Occurred while resetting session for ${bpid}` });
  }
});


app.post("/webhook", async (req, res) => {
  try {
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const statuses = req.body.entry?.[0]?.changes[0]?.value?.statuses?.[0];

    // return testWebhook(req, res)
    if (message) {

      const userPhoneNumber = contact?.wa_id || null;

      // return testWebhook(req,res)

      if(Object.values(nuren_users).includes(userPhoneNumber)) return businessWebhook(req,res)
      else return userWebhook(req, res )
      
    }

    if (statuses) {
      let timestamp = await getIndianCurrentTime()
      const status = statuses?.status
      const id = statuses?.id
      const userPhone = statuses?.recipient_id
      const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
      const activeCampaign = await readData()
      // console.log("Active Campaign: ",typeof activeCampaign)
      const key = `${business_phone_number_id}_${userPhone}`
      if(key in activeCampaign) {
        console.log("bpid is in campaign")
        return campaignWebhook(req, res, activeCampaign[key])
      }

      if (status == "failed"){
        updateStatus(status, id, null, null, null, null, timestamp)
        const error = statuses?.errors[0]
        console.log("Message failed: ", error)
        io.emit('failed-response', error)
        // res.status(400).json(error)
      }
      else if(status == "delivered"){
        updateStatus(status, id, null, null, null, null, timestamp)
        console.log("Delivered: ", userPhone)
        updateLastSeen("delivered", timestamp, userPhone, business_phone_number_id)
      }
      else if(status == "read"){
        updateStatus(status, id, null, null, null, null, timestamp)
        updateLastSeen("seen", timestamp, userPhone, business_phone_number_id)
      }

    }
    console.log("Webhook Processing Complete")
    res.sendStatus(200)
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
  console.log("received req: ", req.body)
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

app.post("/login-flow/:tenant_id", async (req, res) => {
  try {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const tenant_id = req.params.tenant_id;
    console.log("Tenant ID: ", tenant_id)
    const authCode = req.body.code;
    console.log("authCode: ", authCode)


    const access_token = await getAccessToken(authCode);
    console.log("access token: ", access_token);


    const waba_id = await getWabaID(access_token)
    console.log("waba_id: ", waba_id);

    const business_phone_number_id = await getPhoneNumberID(access_token, waba_id);
    console.log("bipd: ", business_phone_number_id)


    await delay(5000);

    
    const register_response = await registerAccount(business_phone_number_id, access_token)


    const postRegister_response = await postRegister(access_token, waba_id)
    
    const response = axios.post(`${djangoURL}/insert-data/`, {
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

    addKey(tenant_id)
    
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

const { APP_SECRET, PASSPHRASE } = process.env
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, '\n')

app.post("/data", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your env variable "PRIVATE_KEY".'
    );
  }
  if(!isRequestSignatureValid(req)) {
    // Return status code 432 if request signature does not match.
    // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
    return res.status(432).send();
  }
  let decryptedRequest = null;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error(err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }
  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  // TODO: Uncomment this block and add your flow token validation logic.
  // If the flow token becomes invalid, return HTTP code 427 to disable the flow and show the message in `error_msg` to the user
  // Refer to the docs for details https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes

  /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const error_response = {
      error_msg: `The message is no longer available`,
    };
    return res
      .status(427)
      .send(
        encryptResponse(error_response, aesKeyBuffer, initialVectorBuffer)
      );
  }
  */

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", screenResponse);

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
});

function isRequestSignatureValid(req) {
  if(!APP_SECRET) {
    console.warn("App Secret is not set up. Please Add your app secret in /.env file to check for request validation");
    return true;
  }
  const signatureHeader = req.get("x-hub-signature-256");
  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");
  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest('hex');
  const digestBuffer = Buffer.from(digestString, "utf-8");
  if ( !crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match");
    return false;
  }
  return true;
}

app.post("/verify-payment", async (req, res) => {
  // console.log(req)
  console.log("Recieved body: ", JSON.stringify(req.body, null, 7))
  res.sendStatus(200)
});

app.post("/start-campaign", async(req,res) => {
  
  console.log("Recieved body: ", JSON.stringify(req.body, null, 7))
  startCampaign(req.body.campaign_id)
  res.sendStatus(200)
})

// req.body = {
//   "type": "campaign" || "template" || "group",
//   "template": {
//     "name": `${template_name}`,
//     "contacts": `${contact_list}`
//   },
//   "campaign": {
//     "id": `${campaign_id}`,
//     "name": `${campaign_name}` || null,
//     "contacts": `${contact_list}` || null,
//     "templateName": `${template_name}` ||  null //first template's name
//   },
//   "group": {
//     "id": `${group_id}`,
//     "name": `${group_name}` || null,
//     "templateName": `${template_name}`,
//     "contacts": `${contact_list}` || null
//   }
// }
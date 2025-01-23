import { messageQueue, getCampaignUserSession, setCampaignUserSession } from "./workerQueues.js";
import axios from "axios";
import { writeFile, readFile } from 'fs/promises';

// const djangoURL = 'http://localhost:8001'
const djangoURL = "https://backeng4whatsapp-dxbmgpakhzf9bped.centralindia-01.azurewebsites.net"

// messageQueue.process('message' ,async (job) => {
//   const { bg_id, bg_name, templateData, business_phone_number_id, access_token, otp, tenant_id, phoneNumbers, batchSize} = job.data;

//   console.log("Data Rcvd: ", job.data)

//   const results = [];

//   for (let i = 0; i < phoneNumbers.length; i += batchSize) {
//     const batch = phoneNumbers.slice(i, i + batchSize);

//     const batchResults = await Promise.allSettled(
//       batch.map(async (phoneNumber) => {
//         try {
//           const messageData = await setTemplate( templateData, phoneNumber, business_phone_number_id, access_token, tenant_id, otp );

//           console.log("Message Data: ", JSON.stringify(messageData, null, 6));

//           const sendMessageResponse = await sendMessageTemplate( phoneNumber, business_phone_number_id, messageData, access_token, null, tenant_id);

//           const messageID = sendMessageResponse.data?.messages[0]?.id;

//           if (messageID) {

//             const broadcastGroup = {
//               id: bg_id || null,
//               name: bg_name || null,
//               template_name: templateData?.name || null,
//             };
            
//             let timestamp = await getIndianCurrentTime()
//             updateStatus( "sent", messageID, business_phone_number_id, phoneNumber, broadcastGroup, tenant_id, timestamp);
//           }

//           return { phoneNumber, status: "success", messageID };
//         } catch (error) {
//           console.error(`Failed to send message to ${phoneNumber}: ${error.message}`);
//           return { phoneNumber, status: "failed", error: error.message };
//         }
//       })
//     );

//     results.push(...batchResults);

//     if (i + batchSize < phoneNumbers.length) {
//       console.log(`Waiting for 1 second before sending the next batch...`);
//       await delay(1000); 
//     }
//   }

//   return results;
// });


// campaignQueue.process('message', async (job) => {
//   const { campaign, templateData, templateInfo } = job.data;

//   for (const contact of campaign.contacts) {
//     const key = `${campaign.bpid}_${contact}`;
//     const userSession = await getSession(key);
//     const messageData = await setTemplateData(templateData, contact, campaign.bpid, campaign.access_token);
//     const message_id = await sendMessage(contact, campaign.bpid, messageData, campaign.access_token, campaign.tenant);

//     userSession.templateInfo = templateInfo;
//     userSession.lastMessageID = message_id;
//     userSessions[key] = userSession;

//     await addData(key, campaign.id);
// }
// })

const numberOfWorkers = 1

messageQueue.process('campaign', numberOfWorkers, async(job) => {
  try{
    const { messageData, contact, templateInfo, campaignData } = job.data
    console.log("Rcvd message queue data in campaign worker: ", job.data)
  
    const key = `${campaignData.bpid}_${contact}`
    const campaignUserSession = await getCampaignUserSession(key)
  
    const messageID = await sendMessage(messageData, contact, campaignData.bpid, campaignData.access_token, campaignData.tenant_id)
    campaignUserSession.templateInfo = templateInfo;
    campaignUserSession.lastMessageID = messageID;
    await setCampaignUserSession(key, campaignUserSession)
    addData(key, campaignData)
    
    const data = {message_id: messageID, status: "sent", type: "campaign", type_identifier: campaignData.name, template_name: templateInfo.name, userPhone: contact, tenant_id: campaignData.tenant_id}
    const res = await axios.post(`${djangoURL}/individual_message_statistics/`, data, {headers: {'bpid': campaignData.bpid}})
    
  }catch(err){
    console.error("Error occured in messageQueue(campaign): ", err)
  }
})

messageQueue.process('template', numberOfWorkers, async(job) => {
  try {
    const { messageData, contact, templateData } = job.data;
    console.log("Rcvd message queue data in template worker: ", job.data);

    const messageID = await sendMessage(messageData, contact, templateData.bpid, templateData.access_token, templateData.tenant_id);

    const data = {
      message_id: messageID,
      status: "sent",
      type: "template",
      type_identifier: templateData.name,
      template_name: templateData.name,
      userPhone: contact,
      tenant_id: templateData.tenant_id
    };
    const res = await axios.post(`${djangoURL}/individual_message_statistics/`, data, { headers: { 'bpid': templateData.bpid } });

  } catch (err) {
    console.error("Error occurred in messageQueue(template): ", err);
  }
});

messageQueue.process('group', numberOfWorkers, async(job) => {
  try {
    const { messageData, contact, groupData } = job.data;
    console.log("Rcvd message queue data in template worker: ", job.data);

    const messageID = await sendMessage(messageData, contact, groupData.bpid, groupData.access_token, groupData.tenant_id);

    const data = {
      message_id: messageID,
      status: "sent",
      type: "group",
      type_identifier: groupData.name,
      template_name: groupData.templateName,
      userPhone: contact,
      tenant_id: groupData.tenant_id
    };
    const res = await axios.post(`${djangoURL}/individual_message_statistics/`, data, { headers: { 'bpid': groupData.bpid } });

  } catch (err) {
    console.error("Error occurred in messageQueue(group): ", err);
  }
});


// import { createClient } from 'redis';
// const client = redis.createClient()

// export async function getCampaignUserSession(key) {
//   return new Promise((resolve, reject) => {
//     client.get(key, (err, result) => {
//       if (err) return reject(err);
//       resolve(result ? JSON.parse(result) : null);
//     });
//   });
// }

// export async function setCampaignUserSession(key, session) {
//   return new Promise((resolve, reject) => {
//     client.set(key, JSON.stringify(session), (err) => {
//       if (err) return reject(err);
//       resolve();
//     });
//   });
// }

async function sendMessage(messageData, contact, bpid, access_token, tenant_id) {
  try{
    const url = `https://graph.facebook.com/v18.0/${bpid}/messages`;
    const headers = { 'Authorization': `Bearer ${access_token}`}

    contact = String(contact).trim();
    if(contact.length == 10) contact = `91${contact}`
    console.log("Sending Message to: ", contact, messageData, headers)
    const response = await axios.post(
      url, 
      {
        messaging_product: "whatsapp", 
        recipient_type: "individual",
        to: contact,
        ...messageData
      },
      {
        headers: headers
      }
    );
    const messageID = response.data.messages[0].id
    console.log("Message  sent successfully: ", messageID)
    return messageID
  }catch(error){
    console.error("Error rcvd in sendMessage: ", JSON.stringify(error, null, 7))
  }
}

import path from 'path'
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, "../dataStore/activeCampaign.json");

export async function readData() {
  try {
      const data = await readFile(filePath, 'utf8');
      return JSON.parse(data);
  } catch (err) {
      console.error('Error reading the file:', err);
      return {};
  }
}

export async function writeData(data) {
  try {
      console.log("Erititng data: ", data, "to file: ", filePath)
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log('Data successfully written to file: ', filePath);
  } catch (err) {
      console.error('Error writing to the file:', err);
  }
}

export async function addData(key, value) {
  try {
      const data = await readData();
      data[key] = value;
      await writeData(data);
      console.log(`Data added successfully for key: ${key}`);
  } catch (err) {
      console.error('Error adding data:', err);
  }
}

export async function deleteData(key) {
  try {
      const data = await readData();
      if (data[key]) {
          delete data[key];
          await writeData(data);
          console.log(`Data deleted for key: ${key}`);
      } else {
          console.log(`Key not found: ${key}`);
      }
  } catch (err) {
      console.error('Error deleting data:', err);
  }
}
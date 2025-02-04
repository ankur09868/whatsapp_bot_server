import { nurenConsumerMap } from "../server.js"
import { sendMessage } from "../send-message.js";
import { setTemplateData } from "../snm.js";
import axios from "axios";
import * as XLSX from 'xlsx';
import { IDENTIFY_HEADERS_PROMPT } from "../dataStore/PROMPTS.js";
import { messageQueue } from "../queues/workerQueues.js";
import { manualWebhook } from "./manualWebhook.js";
import { getSession } from "../helpers/misc.js";


export async function businessWebhook(req, res) {

    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;

    const userSession = await getSession(business_phone_number_id, contact)
    const messageType = message?.type
    const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)

    // if(messageType == "document") sendTemplates(message, userSession)
    if(userSession?.acceptTemplate) return sendTemplates(message, userSession)

    if( message_text){
      if(message_text.startsWith("/")){
        const { messageData, recipient } = await handleCommands(message_text, userSession)
        console.log("Recipient: ", recipient)
        console.log("Message Data: ", messageData)
        sendMessage(recipient, business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
      }
      else if(Object.keys(nurenConsumerMap).includes(userPhoneNumber)) {
        return manualWebhook(req, userSession)
      }
    }
}

async function handleCommands(message_text, userSession){
    const command = message_text.slice(1).split(' ')[0];
    let messageData = null
    let recipient = userSession.userPhoneNumber
  
    switch(command){
      case "button":
        messageData = await sendInteractive(message_text.slice(8))
        recipient = nurenConsumerMap[userSession.userPhoneNumber]
        break
      case "template":
        messageData = await setTemplateData(message_text.slice(9), userSession)
        recipient = nurenConsumerMap[userSession.userPhoneNumber]
        break
      case "sendBill":
  
        break
      // case "help":
      //   messageData = await sendInstructions()
        break
      case "help":
        const templates = await getTemplates(userSession)
        const body = "Please Choose a Template:"
        messageData = await getInteractive(body, templates)
        userSession["acceptTemplate"] = true
        break
        
      default:
        console.log("Invalid Command")
    }
    return { messageData, recipient }
}

async function getTemplates(userSession){
    const waba_id = userSession.accountID
    const response = await axios.get("https://graph.facebook.com/v16.0/"+waba_id+"/message_templates", {headers: {Authorization: "Bearer "+userSession.accessToken}})
    const template_names = response.data.data.reduce((acc, template) => {
      acc.push(template.name)
      
      return acc
    }, [])
  
    console.log("Templates: ", template_names)
    return template_names
}

async function sendInteractive(message_text) {
    console.log("Message Text: ", message_text)
    const message_elements = message_text.split('\n')
    console.log("Message Elements: ", message_elements)
    const message_body = message_elements[0]
    const options = message_elements.slice(1)
    console.log("Options: ", options) 
    const messageData = await getInteractive(message_body, options) 
    return messageData
}

async function getInteractive(body, options){
    if(options.length <= 3){
      let button_rows = options.map((option, index) => ({
        type: 'reply',
        reply: {
          id: index.toString(),
          title: option
        }
      }));
      console.log("Button Rows: ", button_rows)
      const messageData = {
        type: "interactive",
        interactive: {
            type: "button",
            body: { text: body },
            action: { buttons: button_rows }
        }
      }
      console.log("Button Message Data: ", JSON.stringify(messageData, null, 3))
      
      return messageData;
    }
    else if(options.length > 3 && options.length <=10){
  
      const rows = options.map((listNode, index) => ({
        id: index.toString(),
        title: listNode
      }));
  
      const messageData = {
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: body },
          action: { button: "Choose Option:", sections: [{ title: "Section Title", rows }]}
        }
      };
  
      return messageData;
    }
}

async function sendTemplates(message, userSession) {
    
    const messageType = message?.type

    if(messageType == "document"){
        const media_id = message?.document?.id
        const response = await axios.get(`https://graph.facebook.com/v19.0/${media_id}`, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}})
        const media_url = response.data.url
        const media = await axios.get(media_url, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}, responseType: 'arraybuffer'})
        const contact_list = await getContactsFromDocument(media.data)
        console.log("Contacts: ", contact_list)
        const waba_id = userSession.accountID

        const template_response = await axios.get(
          `https://graph.facebook.com/v16.0/${waba_id}/message_templates?name=${userSession?.templateName}`,
          { headers: { Authorization: `Bearer ${userSession?.accessToken}` } }
        );

        const graphResponse = template_response.data;
        
        const templateData = graphResponse.data[0];

        const jobData = {
          bg_id: null,
          bg_name: null,
          templateData: templateData,
          business_phone_number_id: userSession.business_phone_number_id,
          access_token: userSession.accessToken,
          otp: null,
          tenant_id: userSession.tenant,
          phoneNumbers: contact_list, // Send all phone numbers to the worker
          batchSize: 80, // Set batch size for worker
        };
        console.log("Sending data to messageQueue")
    
        messageQueue.add('message', jobData);


        delete userSession?.acceptTemplate
        delete userSession?.templateName
    }
    else{
        const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)
        userSession["templateName"] = message_text
        const message_body = "Please send the list of contacts in valid xls format"
        sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: 'text', text: {body: message_body}}, userSession.accessToken, userSession.tenant)
    }
}

async function getContactsFromDocument(document) {
  const workbook = XLSX.read(document, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log("Json: ", jsonData)
  const headers = jsonData[0]
  const index = await getIndexforPhoneHeader(headers)
  const contact_list = jsonData.map(row => row[index]);
  return contact_list;
}

async function getIndexforPhoneHeader(header_list) {
  const openai_key = process.env.OPENAI_API_KEY;

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'developer',
        content: [
          {
            type: 'text',
            text: IDENTIFY_HEADERS_PROMPT,
          }
        ],
      },
      {
        role: 'user',
        content: [{
          type: 'text',
          text: header_list.toString()
        }]
      }
    ],
  };

  const openAIHeaders = {
    Authorization: `Bearer ${openai_key}`,
    'Content-Type': 'application/json',
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers: openAIHeaders });
    // console.log("Open AI Response: ", response.data)
    const result = response.data.choices[0].message.content;
    // console.log(result);
    if(result == "null") return 1 
    else return result;
  } catch (error) {
    console.error('Error fetching index for phone header:', error);
    throw error;
  }
}
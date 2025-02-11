import { userSessions, nurenConsumerMap } from "../server.js";
import { nuren_users } from "../helpers/order.js";
import { sendMessage } from "../send-message.js";
import { businessWebhook } from "./businessWebhook.js";
import { updateLastSeen, getSession, saveMessage, sendNotification, getIndianCurrentTime } from "../helpers/misc.js";
import { ioEmissions } from "./userWebhook.js";
import { getImageAndUploadToBlob } from "../helpers/handle-media.js";

export async function manualWebhook(req, userSession){
  const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const userPhoneNumber = contact?.wa_id || null;
  const message_text = message?.text?.body

  let recipient;
  let messageData = null

  if (userPhoneNumber in nurenConsumerMap){
    recipient = nurenConsumerMap[userPhoneNumber]
    if (message_text == "close"){
      userSessions.delete(userPhoneNumber+business_phone_number_id)
      const customer_userSession = userSessions.get(recipient+business_phone_number_id)
      customer_userSession.type = "chatbot"
      delete nurenConsumerMap[userPhoneNumber]
      delete customer_userSession?.talking_to
      console.log("Nuren Consumer Map after deleting: ", nurenConsumerMap)
      console.log("Customer User Session after delete: ", customer_userSession)
      return
    }
  }
  else if (userSession.type == "one2one"){
    recipient = userSession?.talking_to
    console.log("Recipient: ", recipient)
    if(recipient === undefined) return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: { body: "Please wait while one of our agents accepts your message request."}}, userSession.accessToken, userSession.tenant)
    if(message_text && message_text.startsWith("/")) {
      const messageData = {type: "text", text: {body: "Sorry, you are not authorized to use this command."}}
      sendMessage(userPhoneNumber, business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
    }
    
  }
  const messageType = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0].type
  const keysToRemove = ['mime_type', 'sha256', 'animated'];

  let filteredMessageType = Object.keys(message[messageType])
    .filter(key => !keysToRemove.includes(key))
    .reduce((obj, key) => {
      obj[key] = message[messageType][key];
      return obj;
    }, {});
    console.log("Filtered Message Type: ", filteredMessageType)

    if (messageType === 'contacts') {
      filteredMessageType = Object.values(filteredMessageType);
    }

  if(!messageData) messageData = { type: messageType, [messageType]: filteredMessageType }
  
  sendMessage(recipient, business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
}

export async function testWebhook(req, res) {
  console.log("Received Webhook: ", JSON.stringify(req.body, null, 5))
}

export async function manualWebhook2(req, userSession){
  const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const userPhoneNumber = contact?.wa_id || null;
  const userName = contact?.profile?.name || null
  const messageType = message?.type
  const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null) || message?.button?.text || message?.audio?.id || message?.document?.id



  let timestamp = await getIndianCurrentTime()

  updateLastSeen("replied", timestamp, userSession.userPhoneNumber, userSession.business_phone_number_id)

  let formattedConversation;
  if(messageType == "text" || messageType == "interactive" || messageType == "button"){
    formattedConversation= [{
      text: message_text,
      sender: "user"
    }];
  }
  else{
    const mediaID = message?.image?.id || message?.audio?.id || message?.document?.id || message?.video?.id
    if (mediaID != undefined){
      const mediaURL = await getImageAndUploadToBlob(mediaID, userSession.accessToken)
      const mediaData = {type: messageType, [`${messageType}`]: {id: mediaURL}}
      formattedConversation = [{
        text: JSON.stringify(mediaData),
        sender: "user"
      }]
    }
  }

  saveMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, formattedConversation, userSession.tenant, timestamp)

  const notif_body = {content: `${userSession.userPhoneNumber} | New meessage from ${userSession.userName || userSession.userPhoneNumber}: ${message_text}`, created_on: timestamp}
  sendNotification(notif_body, userSession.tenant)

  ioEmissions(message, userSession, timestamp)

  const agents = userSession.agents
  if(agents){
    const isBusiness = agents.includes(userPhoneNumber)
    if(isBusiness) return businessWebhook2(req, userSession)
    else return customerWebhook2(req, userSession)
  }
}

async function businessWebhook2(req, userSession) {
  
  const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const userPhoneNumber = contact?.wa_id || null;
  const userName = contact?.profile?.name || null
  const messageType = message?.type

  if(messageType == "interactive"){
    const selectionId = message?.interactive?.button_reply?.id
    const recipient = selectionId.slice(9)
    const isAgentAssigned = Object.values(nurenConsumerMap).includes(recipient);
    console.log("Agent Assigned: ", isAgentAssigned)
    if(selectionId.startsWith('chatwith')){
      if(!isAgentAssigned){
        const welcomeMessageForConsumer = `${userName} is here to chat with you!\nType your queries or just say hello! Lets get this conversation going.`
        
        const key = recipient + business_phone_number_id
        const customerUserSession = userSessions.get(key)

        if(customerUserSession) customerUserSession["talking_to"] = userPhoneNumber
        console.log("Connecting user: ", recipient, "to Agent: ", userPhoneNumber)
        nurenConsumerMap[userPhoneNumber] = recipient
        userSessions.set(key, customerUserSession);
        sendMessage(userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: "You're now connected! Expect responses from the user soon. 📩"}})
        return sendMessage(recipient, userSession.business_phone_number_id, {type: "text", text: {body: welcomeMessageForConsumer}}, userSession.accessToken, userSession.tenant)
      }else{
        sendMessage(userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: "This customer has been already assigned to another agent."}}, userSession.accessToken, userSession.tenant)
      }
    }
  }
  else if(messageType == "text"){
    const message_text = message?.text?.body
    if(message_text == "/exit"){
      userSessions.delete(userPhoneNumber+business_phone_number_id)
      const recipient = nurenConsumerMap[userPhoneNumber]
      sendMessage(recipient, userSession.business_phone_number_id, {type: "text", text: {body: "This conversation has been closed."}}, userSession.accessToken, userSession.tenant)

      const customer_userSession = userSessions.get(recipient+business_phone_number_id)
      customer_userSession.type = "chatbot"
      delete nurenConsumerMap[userPhoneNumber]
      delete customer_userSession?.talking_to
      console.log("Nuren Consumer Map after deleting: ", nurenConsumerMap)
      console.log("Customer User Session after delete: ", customer_userSession)
      return
    }
    else return manualWebhook(req, userSession)
  }
}

async function customerWebhook2(req, userSession) {
  const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const userPhoneNumber = contact?.wa_id || null;
  
  if(userSession.type == "one2one"){
    return manualWebhook(req, userSession)
  }
  else{
    const isAgentAvailable = await checkAgentAvailability(userSession)
    console.log("agent available? ", isAgentAvailable)
    if(isAgentAvailable){
      userSession.type = "one2one"
      const key = userPhoneNumber + business_phone_number_id
      userSessions.set(key, userSession);
      return sendWelcomeMessage(userSession, message)
    }
  }
}

async function checkAgentAvailability(userSession) {
  const agents = userSession.agents
  return agents.some(agent => !(agent in nurenConsumerMap));
}

async function sendWelcomeMessage(userSession, message) {
  const customerMessage = message?.text?.body
  const waitingMessageForConsumer = "Hang tight! We're connecting you with an agent. It won’t take long. ⏳"  
  sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: waitingMessageForConsumer}}, userSession.accessToken, userSession.tenant)

  const welcomeMessageForRetailer = `${userSession.userName} wants to chat with you! Press the button to start the conversation. 🚀`  
  const buttonMessageBody = {        
    type: "interactive", 
    interactive: {
      type: "button", 
      body: { text: welcomeMessageForRetailer }, 
      action: { buttons: [{type: "reply", reply: {id: `chatwith_${userSession.userPhoneNumber}`, title: "Start Talking"}}]}
    }
  }
  const agents = userSession.agents
  agents.forEach(agent => {
    sendMessage(agent, userSession.business_phone_number_id, buttonMessageBody, userSession.accessToken, userSession.tenant)
    sendMessage(agent, userSession.business_phone_number_id, {type: "text", text: {body: customerMessage}}, userSession.accessToken, userSession.tenant)
  })
}
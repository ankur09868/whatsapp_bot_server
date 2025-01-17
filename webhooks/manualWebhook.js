import { userSessions, nurenConsumerMap } from "../server.js";
import { nuren_users } from "../helpers/order.js";
import { sendMessage } from "../send-message.js";


export async function manualWebhook(req, userSession){
  const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
  const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
  const userPhoneNumber = contact?.wa_id || null;
  const message_text = message?.text?.body

  let recipient;
  let messageData = null

  if (Object.values(nuren_users).includes(userPhoneNumber)){
    recipient = nurenConsumerMap[userPhoneNumber]

    if (message_text == "close"){
      userSessions.delete(userPhoneNumber+business_phone_number_id)
      const customer_userSession = userSessions.get(recipient+business_phone_number_id)
      customer_userSession.type = "chatbot"
      delete nurenConsumerMap[userPhoneNumber]
      delete customer_userSession?.nuren
      console.log("Nuren Consumer Map after deleting: ", nurenConsumerMap)
      console.log("Customer User Session after delete: ", customer_userSession)
      return
    }
  }
  else if (userSession.type == "whatsapp"){
    recipient = userSession?.nuren
    console.log("Recipient: ", recipient)

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
  res.sendStatus(200)
}
import { getIndianCurrentTime, updateStatus, updateLastSeen, saveMessage, sendNotification, executeFallback, getSession  } from "../helpers/misc.js";
import { nurenConsumerMap, io, customWebhook, userSessions } from "../server.js";
import { nuren_users } from "../helpers/order.js";
import { sendNodeMessage, sendTextMessage, sendProductMessage, djangoURL } from "../snm.js";
import { sendProduct } from "../helpers/product.js";
import { DRISHTEE_PRODUCT_CAROUSEL_IDS, handleCatalogManagement }  from "../drishtee.js"
import { sendMessage } from "../send-message.js";
import { handleMediaUploads, getImageAndUploadToBlob } from "../helpers/handle-media.js";
import { languageMap } from "../dataStore/dictionary.js";
import { sendMessagetoConsumer, sendMessagetoRetailer, orderToDB } from "../helpers/order.js";
import { manualWebhook } from "./manualWebhook.js";
import axios from "axios";
import FormData from 'form-data';
import https from 'https';
import { financeBotWebhook } from "./financeBotWebhook.js";
import { promptWebhook } from "./customCommandsWebhooks.js";

const agent = new https.Agent({
  rejectUnauthorized: false, // Disable SSL certificate verification //VERY VERY IMPORTANT SECURITY
});


export async function userWebhook(req, res) {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;
    const userName = contact?.profile?.name || null
    const products = message?.order?.product_items
    
    const message_type = message?.type
    const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null) || message?.button?.text || message?.audio?.id || message?.document?.id

    let timestamp = await getIndianCurrentTime()
    
    const repliedTo = message?.context?.id || null
    if (repliedTo !== null) updateStatus("replied", repliedTo, null, null, null, null, timestamp)
  
    let userSession = await getSession(business_phone_number_id, contact)
    // console.log("User Session Type: ", userSession.type)
    const agents = userSession.agents
    if(agents){
      const isBusiness = agents.includes(userPhoneNumber)
      if(isBusiness) return businessWebhook(req, res)
    }

    if(userSession.type == "one2one"){
      return manualWebhook(req, userSession)
    }
    else if(userSession.type == 'finance'){
      return financeBotWebhook(req, res, userSession)
    }
    else if(userSession.type == 'prompt'){
      return promptWebhook(req, res, userSession)
    }

    if(message_text == "/human") {
      userSession.type = "one2one"
      const key = userPhoneNumber + business_phone_number_id
      userSessions.set(key, userSession);
      return sendWelcomeMessage(userSession)
    }
    else if(message_text == '/finance'){
      userSession.type = 'finance'
      return financeBotWebhook(req, res, userSession)
    }
    else if(message_text == '/prompt'){
      userSession.type = 'prompt'
      return promptWebhook(req, res, userSession)
    }

    updateLastSeen("replied", timestamp, userSession.userPhoneNumber, userSession.business_phone_number_id)

    let formattedConversation;
    if(message_type == "text" || message_type == "interactive" || message_type == "button"){
      formattedConversation= [{
        text: message_text,
        sender: "user"
      }];
    }
    else{
      // console.log("MESSAGE: ", JSON.stringify(message, null, 4))
      const mediaID = message?.image?.id || message?.audio?.id || message?.document?.id || message?.video?.id
      // console.log("Media ID: ", mediaID)
      if (mediaID != undefined){
        const mediaURL = await getImageAndUploadToBlob(mediaID, userSession.accessToken)
        const mediaData = {type: message_type, [`${message_type}`]: {id: mediaURL}}
        formattedConversation = [{
          text: JSON.stringify(mediaData),
          sender: "user"
        }]
      }    
    }
    // console.log("Formatted Conv: ", formattedConversation)
    saveMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, formattedConversation, userSession.tenant, timestamp)

    const notif_body = {content: `${userSession.userPhoneNumber} | New meessage from ${userSession.userName || userSession.userPhoneNumber}: ${message_text}`, created_on: timestamp}
    sendNotification(notif_body, userSession.tenant)

    ioEmissions(message, userSession, timestamp)
    if(userSession.tenant == 'leqcjsk'){
      if(userSession?.isRRPEligible == undefined) userSession = await checkRRPEligibility(userSession)
      if(userSession?.isRRPEligible && message?.type == "order") return processOrderForDrishtee(userSession, products)
      else if(!userSession?.isRRPEligible){
        const messageData = {
          type: 'text',
          text: {
            body: 'Sorry, our services are not available in your area. Please join our RRP network to avail these services.'
          }
        }
        return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
      }
    }
    if (!userSession.multilingual){
      if (!userSession.AIMode) {
        handleInput(userSession, message_text)
        if (message?.type === "interactive") {
            let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
  
            if (userSelectionID.split('_')[0] == 'drishtee') handleCatalogManagement(userSelectionID, userSession)
            else if(userSelectionID.includes('confirm') || userSelectionID.includes('cancel')) handleOrderManagement(userSession, userSelectionID)
            else{
              try {
                for (let i = 0; i < userSession.nextNode.length; i++) {
                  if (userSession.flowData[userSession.nextNode[i]].id == userSelectionID) {
                    userSession.currNode = userSession.nextNode[i];
                    userSession.nextNode = userSession.adjList[userSession.currNode];
                    userSession.currNode = userSession.nextNode[0];
                    break;
                  }
                };
                if(isNaN(userSelectionID)) await sendProduct(userSession, userSelectionID)
              } catch (error) {
                console.error('Error processing interactive message:', error);
              }
            }
        }
        else if (message?.type === "text" || message?.type == "image") {
          const flow = userSession.flowData
          const type = flow[userSession.currNode].type
          if (userSession.currNode != userSession.startNode){
            console.log("Type: ", type)
            if (['Text' ,'string', 'audio', 'video', 'location', 'image', 'AI', 'product'].includes(type)) {
              userSession.currNode = userSession.nextNode[0];
            }
            else if(['Button', 'List'].includes(type)){
              await executeFallback(userSession)
              return
            }
          }
        }
        else if (message?.type == "button"){
          const userSelectionText = message?.button?.text
          console.log("User Selection Text: ", userSelectionText)
          if (DRISHTEE_PRODUCT_CAROUSEL_IDS.includes(userSelectionText)) await handleCatalogManagement(userSelectionText, userSession)
          userSession.currNode = userSession.nextNode[0];
        }
        else if(message?.type == "audio"){
          // if(userSession.tenant == 'leqcjsk') await handleAudioOrdersForDrishtee(message, userSession)
          userSession.currNode = userSession.nextNode[0];
        }
        else if(message?.type == "document"){
          userSession.currNode = userSession.nextNode[0];
        }
        else if(message?.type == "order"){
          userSession.currNode = userSession.nextNode[0];
        }
        sendNodeMessage(userPhoneNumber,business_phone_number_id);
      }else {
        if (message?.type == "interactive"){
            let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
            if (userSelectionID == "Exit AI"){
                userSession.AIMode = false;
                userSession.nextNode = userSession.adjList[userSession.currNode];
                userSession.currNode = userSession.nextNode[0];
                sendNodeMessage(userPhoneNumber,business_phone_number_id);
            }
        }
        else if(message?.type == "text"){
            handleQuery(message, userSession)
        }
        else if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
            const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
            const doc_name = userSession.inputVariable
            try {
                await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
            } catch (error) {
                console.error("Error retrieving media content:", error);
            }
        }
      }
    }
    else{
      if (message?.type === "text" || message_type == "button"){
        const doorbell = userSession.doorbell
        const doorbell_text = doorbell?.message
        const language_data = doorbell?.languages
        
        const languageKeys = Object.keys(language_data);
        const languageValues = Object.values(language_data)
        
        if (languageKeys.includes(message_text) || languageValues.includes(message_text)){
          let lang_code;
          if (languageKeys.includes(message_text)){
            const language = language_data[message_text]
            lang_code = languageMap[language]
          }else{
            lang_code = languageMap[message_text]
          }
          
          const flowData = userSession.flowData
          userSession.language = lang_code
          const selectedFlowData = flowData.find(data => data.language === lang_code);
  
          userSession.flowData = selectedFlowData?.flow_data
          userSession.multilingual = false
          
          userSession.fallback_msg = selectedFlowData?.fallback_message
          
          sendNodeMessage(userPhoneNumber,business_phone_number_id);
  
        }
        else{
          sendLanguageSelectionMessage(doorbell_text, userSession.accessToken, userSession.userPhoneNumber, userSession.business_phone_number_id, userSession.tenant)
        }
        
      }
      else if (message?.type === "interactive") {
        // let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
  
        // if(userSelectionID.includes('confirm') || userSelectionID.includes('cancel')) {
        //   return handleOrderManagement(userSession, userSelectionID)
        // }
  
        // userSession.language = userSelectionID;
        // const flowData = userSession.flowData
        // const selectedFlowData = flowData.find(data => data.language === userSelectionID);
        
        // userSession.flowData = selectedFlowData?.flow_data
        // userSession.multilingual = false
        // userSession.fallback_msg = selectedFlowData?.fallback_message
        // sendNodeMessage(userPhoneNumber,business_phone_number_id);
        
      }
    }
    
    console.log("Webhook processing completed successfully");
}

function assignAgent(agentList){
  for(let agent of agentList){
    if (agent in nurenConsumerMap) continue
    else return agent
  }
  return agentList[0]
}

async function sendWelcomeMessage(userSession){
  const welcomeMessageForConsumer = "You're now connected to a live agent! Drop your message here, and we'll get back to you shortly. 😊"  
  const waitingMessageForConsumer = "Hang tight! We're connecting you with an agent. It won’t take long. ⏳"  
  sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: waitingMessageForConsumer}}, userSession.accessToken, userSession.tenant)

  const welcomeMessageForRetailer = `${userSession.userName} wants to chat with you! Press the button to start the conversation. 🚀`  
  const buttonMessageBody = {        
    type: "interactive", 
    interactive: {
      type: "button", 
      body: { text: welcomeMessageForRetailer }, 
      action: { buttons: [{type: "reply", reply: {id: `chatwith_${userSession.userPhoneNumber}`, title: "Start Talking"}}]}}
  }
  const agents = userSession.agents
  agents.forEach(agent => {
    sendMessage(agent, userSession.business_phone_number_id, buttonMessageBody, userSession.accessToken, userSession.tenant)
  })
}

async function checkRRPEligibility(userSession) {
  try {
    if (userSession?.isRRPEligible != undefined) return userSession
    const phone = userSession.userPhoneNumber.slice(2);
    console.log("Checking for phone: ", phone);

    const response = await axios.post(
      'https://testexpenses.drishtee.in/rrp/nuren/checkRRp',
      { 'rrp_phone_no': phone},
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log("Response for checking eligibility: ", response.data);

    if (response.data.RRP_id) {
      console.log("Response RRP Id: ", response.data.RRP_id)
      userSession.isRRPEligible = true;
    }
    console.log("User Session for RRP: ", userSession)
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        userSession.isRRPEligible = false
        console.error("Error: 404 Not Found - RRP service unavailable for this phone number");
      } else {
        console.error(`Error: ${error.response.status} - ${error.response.data}`);
      }
    } else if (error.request) {
      console.error("Error: No response received from the server", error.request);
    } else {
      console.error("Error: Unexpected issue occurred", error.message);
    }
  }
  return userSession;
}

async function processOrderForDrishtee(userSession, products) {
  const responseMessage_hi = "धन्यवाद! आपकी प्रतिक्रिया हमें मिल गई है। अब हम आपके ऑर्डर को आगे बढ़ा रहे हैं। हमें फिर से सेवा का मौका दें, यह हमारा सौभाग्य होगा।";
  const responseMessage_en = "Thank you! We've received your response. We're now moving ahead to place your order. Looking forward to serving you again!";
  const responseMessage_bn = "আপনার উত্তর পাওয়া গেছে, ধন্যবাদ! আমরা এখন আপনার অর্ডার প্রসেস করার কাজ এগিয়ে নিচ্ছি। আবার আপনাকে সাহায্য করতে পারলে ভালো লাগবে।";
  const responseMessage_mr = "धन्यवाद! तुमचा प्रतिसाद आम्हाला मिळाला आहे. आता तुमची ऑर्डर पुढे नेण्याची प्रक्रिया सुरू करत आहोत. कृपया पुन्हा भेट द्या, आम्हाला आनंद होईल.";
  let responseMessage = responseMessage_en;

  const language = userSession.language

  if(language == "mr") responseMessage = responseMessage_mr
  else if(language == "bn") responseMessage = responseMessage_bn
  else if(language == "hi") responseMessage = responseMessage_hi

  // const failureMessage = userSession.language == "en" ? failureMessage_en: failureMessage_hi
  // sendTextMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, responseMessage, userSession.accessToken, userSession.tenant)
  console.log("Products: ", products)
  const phone = userSession.userPhoneNumber.slice(2)
  const url = "https://testexpenses.drishtee.in/rrp/nuren/savePreOrder"
  const headers = {'Content-Type': 'application/json'}
  const data = {
    rrp_phone_no: phone,
    products: products.map(product => {
      return {
        product_id: product.product_retailer_id,
        product_quantity: product.quantity
      }
    })
  }
  try{
    await axios.post(url, data, {headers: headers})
  }catch(error){
    console.error("Error in processOrderForDrishtee: ", error)
    if (error.response) {
      if (error.response.status === 404) {
        userSession.isRRPEligible = false
        console.error("Error: 404 Not Found - RRP service unavailable for this phone number");
        const messageData = {
          type: 'text',
          text: {
            body: 'Sorry, our services are not available in your area. Please join our RRP network to avail these services.'
          }
        }
        return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
      } else {
        console.error(`Error: ${error.response.status} - ${error.response.data}`);
      }
    return
    }
  }
  await  generateBill(products, userSession)
  const messageData = {
    type: "image",
    image: {
      id: 481154868087797,
      caption: captionLanguage?.[`${userSession.language}`]
    }
  }
  await sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
}

const captionLanguage = {
  en : "Scan the QR code to complete your payment for the order. Thank you!",
  mr : "आपला ऑर्डरचा पेमेंट पूर्ण करण्यासाठी QR कोड स्कॅन करा. धन्यवाद!",
  as : "আপোনাৰ অৰ্ডাৰৰ পৰিশোধ সম্পূৰ্ণ কৰিবলৈ QR কোড স্কেন কৰক। ধন্যবাদ!",
  hi : "अपने ऑर्डर के भुगतान के लिए QR कोड स्कैन करें। धन्यवाद!",
  bn : "আপনার অর্ডারের অর্থপ্রদান সম্পূর্ণ করতে QR কোডটি স্ক্যান করুন। ধন্যবাদ!"
}

async function processOrder(userSession, products) {
  let totalAmount = 0;
  const product_list = []
  console.log("Products: ", products)
  for (let product of products){
      console.log("Product: ", product)
      totalAmount+=product.item_price * product.quantity
      const product_id = product.product_retailer_id;
      console.log("product id: ", product_id)
      const product_name = userSession.products.find(product_c => product_c.product_id === product_id)
      console.log("product nameeeeee: ", product_name)
      product_list.push({"id": product_id, "quantity": product.quantity, "product_name": product_name.title})
  }
  console.log("Total Amount = ", totalAmount)
  // console.log(product_list)

  const response = await axios.post(`${djangoURL}/process-order/`, {order: product_list},{
      headers: {
          'X-Tenant-Id': userSession.tenant
      }
  })
  if (response.data.status == 'success'){
      await sendBill(totalAmount, product_list, userSession)
  }
  else if (response.data.status == 'failure'){
      const reason  = response.data.reason
      var failureMessage;
      if (reason == 'insufficient_quantity'){
          failureMessage = "We regret to inform you that your order could not be processed due to insufficient stock availability. We are actively working to replenish our inventory as soon as possible. We apologize for any inconvenience this may have caused."
          sendTextMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, failureMessage, userSession.accessToken, userSession.tenant)
      }
  }
}

async function processOrder2(userSession, products) {
  console.log("Products: ", products)
  const order_details = await orderToDB("create", products, userSession, "pending", null)
  console.log("Response: ", order_details)
  const orderID = order_details.id
  await sendMessagetoConsumer("orderTaken", userSession, orderID, products)
  await sendMessagetoRetailer(products, userSession, orderID)
  console.log("Order Saved to DB and Messages Sent")
}

async function handleQuery(message, userSession) {
  const query = message?.text?.body
  const data = {query: query, phone: userSession.userPhoneNumber}
  const headers = { 'X-Tenant-Id': userSession.tenant }

  const response = await axios.post(`${djangoURL}/query-faiss/`, data, {headers:  headers})

  let messageText = response.data
  const fixedMessageText = messageText.replace(/"/g, "'");
  const messageData = {
  type: "interactive",
  interactive: {
      type: "button",
      body: { text: fixedMessageText },
      action: {
      buttons: [
          {
          type: 'reply',
          reply: {
          id: "Exit AI",
          title: "Exit"
          } 
          }
      ]
      }
  }
  }
  sendMessage(userPhoneNumber, business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
}

async function sendLanguageSelectionButtonMessage(language_list, message,access_token, phoneNumber, business_phone_number_id, tenant_id) {
    console.log("LANGUAGE LIST: ", language_list)
        let button_rows = language_list.map(buttonNode => ({
            type: 'reply',
            reply: {
                id: buttonNode.id,
                title: buttonNode.name
            }
        }));
        console.log("button_row:" ,button_rows)
        const messageData = {
            type: "interactive",
            interactive: {
                type: "button",
                body: { text: message },
                action: { buttons: button_rows }
            }
    }
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
}

async function sendLanguageSelectionListMessage(language_list, message, access_token, phoneNumber, business_phone_number_id, tenant_id) {
  
    const rows = language_list.map((listNode) => ({
      id: listNode.id,
      title: listNode.name
    }));
    const messageData = {
        type: "interactive",
        interactive: {
            type: "list",
            body: { text: message },
            action: {
                button: "Choose Option",
                sections: [{ title: "Section Title", rows }]
            }
        }
    };
    
    return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
}

async function sendLanguageSelectionMessage(message_text, access_token, phoneNumber, business_phone_number_id, tenant_id) {
    console.log("Doorbell Text: ", message_text)
    const messageData = {
      type: "text",
      text: {
        body: message_text
      }
    }
  
  return sendMessage(phoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
}

async function handleOrderManagement(userSession, userSelectionID){
    const order_id = userSelectionID.split('_')[1]
    const order_status = userSelectionID.split('_')[0]
    
    if(order_status == "confirm"){
      await sendMessagetoConsumer("orderConfirmed", userSession, order_id )
      orderToDB("update", null, userSession, "confirmed", order_id)
    }
    else if(order_status == "cancel"){
      await sendMessagetoConsumer("orderCancelled", userSession, order_id)
      orderToDB("update", null, userSession, "cancelled", order_id)
    }
}

async function handleInput(userSession, value) {
  console.log("handleInput called with value:", value);
  
  try {
    if (
      userSession.inputVariable !== undefined && 
      userSession.inputVariable !== null && 
      userSession.inputVariable.length > 0
    ) {
      console.log("Valid inputVariable detected:", userSession.inputVariable);

      const input_variable = userSession.inputVariable;
      const phone = userSession.userPhoneNumber;
      const flow_name = userSession.flowName;

      console.log("Extracted user session details:", { input_variable, phone, flow_name });

      userSession.api.POST[input_variable] = value;
      console.log(`Stored
         value in userSession.api.POST[${input_variable}] = ${value}`);

      userSession.inputVariable = null;
      console.log("Cleared inputVariable after storing value");

      const payload = { flow_name, input_variable, value, phone };
      console.log("Constructed payload:", payload);

      try {
        console.log("Sending data to API:", `${djangoURL}/add-dynamic-data/`);
        const response = await axios.post(`${djangoURL}/add-dynamic-data/`, payload, {
          headers: { 'X-Tenant-Id': userSession.tenant }
        });

        console.log("Data sent successfully! Response:", response.data);
      } catch (error) {
        console.error("Error while sending data in handleInput:", error.response?.data || error.message);
      }
    } else {
      console.log("No valid inputVariable found, skipping API call.");
    }
  } catch (error) {
    console.error("Unexpected error in handleInput:", error);
  }

  console.log("Returning updated userSession:", userSession);
  return userSession;
}

async function sendInstructions() {
  const body = `
  Instructions: 📝  

🔘 **Button**:  
   /button [MESSAGE TEXT]
   ➡️ (next line) option 1  
   ➡️ (next line) option 2  
   ... and so on  

📋 **Template**:  
   /template [TEMPLATENAME]

💡 For more help, please contact support.  

  `
const messageData = {type: "text", text: {body: body}}  
return messageData

}

async function ioEmissions(message, userSession, timestamp){
  const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)
  const temp_user = message?.text?.body?.startsWith('*/') ? message.text.body.split('*/')[1]?.split(' ')[0] : null;
  if(temp_user){
    io.emit('temp-user', {
        temp_user: temp_user,
        phone_number_id: userSession.business_phone_number_id,
        contactPhone: userSession.userPhoneNumber,
        time: timestamp
    });
      // console.log("Emitted temp_user message: ", temp_user)
  }

  io.emit('new-message', {
    message: {type: "text" ,text: {body: message_text}},
    phone_number_id: userSession.business_phone_number_id,
    contactPhone: userSession.userPhoneNumber,
    name: userSession.userName,
    time: timestamp
  });
}

export async function handleAudioOrdersForDrishtee(mediaID, userSession) {
  try{
    let response = await axios.get(`https://graph.facebook.com/v18.0/${mediaID}`, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}})
    const mediaURL = response.data.url
    response = await axios.get(mediaURL, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}, responseType: 'arraybuffer'}) 
    const audioFile = response.data
    const formData = new FormData();
    formData.append('file', audioFile, 'audio.mp4');// Attach the file stream to FormData

    response = await axios.post(
      'https://www.aptilab.in/api/process/drishtee/product/search/',
      formData,
      {
        headers: { ...formData.getHeaders() }, // Include headers from FormData
        httpsAgent: agent,
      }
    );
    const product_list = response.data.data.data
    console.log("Product List: ", product_list)
    let product_body, fallback_message;
    const language = userSession.language

    if(language == "en"){
      product_body = `Browse through our exclusive collection of products and find what suits your needs best. Shop now and enjoy amazing offers!`
      fallback_message = "Oops! It looks like this item is currently out of stock. Don't worry, we're working hard to restock it soon! In the meantime, feel free to browse similar products or check back later."
    }
    else if(language == "bn"){
      product_body = "আমাদের বিশেষ পণ্যের সংগ্রহ দেখুন এবং আপনার প্রয়োজন অনুযায়ী পছন্দ করুন। এখনই কেনাকাটা করুন এবং চমৎকার অফার উপভোগ করুন!"
      fallback_message = "ওহ! এটা বর্তমানে স্টক আউট রয়েছে। চিন্তা করবেন না, আমরা শীঘ্রই এটি পুনরায় স্টক করব! এর মধ্যে, আপনি অনুরূপ পণ্যগুলি দেখতে পারেন অথবা পরে আবার চেক করতে পারেন।"
    }
    else if(language == "hi"){
      product_body = "हमारे उत्पादों के विशेष संग्रह को ब्राउज़ करें और अपनी आवश्यकताओं के अनुसार सबसे उपयुक्त उत्पाद खोजें। अभी खरीदारी करें और शानदार ऑफ़र्स का आनंद लें!"
      fallback_message = "क्षमा करें! यह उत्पाद वर्तमान में स्टॉक में उपलब्ध नहीं है। कृपया चिंता न करें, इसे शीघ्र ही स्टॉक में लाने के लिए हम प्रयासरत हैं। तब तक, आप समान उत्पाद ब्राउज़ कर सकते हैं या बाद में पुनः जांच सकते हैं।";
    }
    else if(language == "mr"){
      product_body = "आमच्या खास उत्पादनांच्या संग्रहातून ब्राउज करा आणि तुमच्या गरजेनुसार सर्वोत्तम निवडा. आत्ताच खरेदी करा आणि आश्चर्यकारक ऑफर्सचा आनंद घ्या!"
      fallback_message = "ओह! हे सध्या स्टॉकमध्ये नाही. काळजी करू नका, आम्ही लवकरच ते पुन्हा स्टॉक करू! तोपर्यंत, कृपया समान उत्पादने बघा किंवा नंतर पुन्हा तपासा."
    }

    if(Array.isArray(product_list) && product_list.length>0){
      const header = "Items"
      const catalog_id = 1822573908147892
      const footer = null
      const section_title = "Items"
      const chunkSize = 30;
      for (let i = 0; i < product_list.length; i += chunkSize) {
        const chunk = product_list.slice(i, i + chunkSize);
        await sendProductMessage(userSession, chunk, catalog_id, header, product_body, footer, section_title, userSession.tenant);
      }
    }
    else{
      const messageData = {
        type: "text",
        text: { body: fallback_message }
      }
      return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken ,userSession.tenant);
    }
  }catch(error){
    console.error("An Error occured in handleAudioForDrishtee: ", error)
  }
}

export async function handleTextOrdersForDrishtee(message, userSession) {
  console.log("Received text message: ", message)

  const formData = new FormData();
  formData.append('query', message);// Attach the file stream to FormData

  const response = await axios.post(
    'https://www.aptilab.in/api/process/drishtee/product/search/',
    formData,
    {
      headers: { ...formData.getHeaders() }, // Include headers from FormData
      httpsAgent: agent,
    }
  );
  console.log("Rsponse: ", response.data)
  const product_list = response.data.data.data
  console.log("Product List: ", product_list, typeof product_list)
  let product_body, fallback_message;
  const language = userSession.language

  if(language == "en"){
    product_body = `Browse through our exclusive collection of products and find what suits your needs best. Shop now and enjoy amazing offers!`
    fallback_message = "Oops! It looks like this item is currently out of stock. Don't worry, we're working hard to restock it soon! In the meantime, feel free to browse similar products or check back later."
  }
  else if(language == "bn"){
    product_body = "আমাদের বিশেষ পণ্যের সংগ্রহ দেখুন এবং আপনার প্রয়োজন অনুযায়ী পছন্দ করুন। এখনই কেনাকাটা করুন এবং চমৎকার অফার উপভোগ করুন!"
    fallback_message = "ওহ! এটা বর্তমানে স্টক আউট রয়েছে। চিন্তা করবেন না, আমরা শীঘ্রই এটি পুনরায় স্টক করব! এর মধ্যে, আপনি অনুরূপ পণ্যগুলি দেখতে পারেন অথবা পরে আবার চেক করতে পারেন।"
  }
  else if(language == "hi"){
    product_body = "हमारे उत्पादों के विशेष संग्रह को ब्राउज़ करें और अपनी आवश्यकताओं के अनुसार सबसे उपयुक्त उत्पाद खोजें। अभी खरीदारी करें और शानदार ऑफ़र्स का आनंद लें!"
    fallback_message = "क्षमा करें! यह उत्पाद वर्तमान में स्टॉक में उपलब्ध नहीं है। कृपया चिंता न करें, इसे शीघ्र ही स्टॉक में लाने के लिए हम प्रयासरत हैं। तब तक, आप समान उत्पाद ब्राउज़ कर सकते हैं या बाद में पुनः जांच सकते हैं।";
  }
  else if(language == "mr"){
    product_body = "आमच्या खास उत्पादनांच्या संग्रहातून ब्राउज करा आणि तुमच्या गरजेनुसार सर्वोत्तम निवडा. आत्ताच खरेदी करा आणि आश्चर्यकारक ऑफर्सचा आनंद घ्या!"
    fallback_message = "ओह! हे सध्या स्टॉकमध्ये नाही. काळजी करू नका, आम्ही लवकरच ते पुन्हा स्टॉक करू! तोपर्यंत, कृपया समान उत्पादने बघा किंवा नंतर पुन्हा तपासा."
  }

  if(Array.isArray(product_list) && product_list.length>0){
    const header = "Items"
    const catalog_id = 1822573908147892
    const footer = null
    const section_title = "Items"
    const chunkSize = 30;
    for (let i = 0; i < product_list.length; i += chunkSize) {
      const chunk = product_list.slice(i, i + chunkSize);
      await sendProductMessage(userSession, chunk, catalog_id, header, product_body, footer, section_title, userSession.tenant);
    }
  }
  else{
    const messageData = {
      type: "text",
      text: { body: fallback_message }
    }
    return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken ,userSession.tenant);
  }
}

import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { businessWebhook } from "./businessWebhook.js";

async function generateBill(products, userSession) {
  const language = userSession.language;
  
  const spreadsheetIds = {
    en: '1EuXHDggvZIVtdfowNJceXIHjJjpKwr1Z-k6fpoo3u_M',
    hi: '1F_nEekNQfxPGkeqzSfQMHjXBF0VOfbfs-1uvN13oj0U',
    bn: '16NK-etS2LsOgQINWCf8HbossHq6-qtrEhspS0uc956c',
    mr: '1egMI_4FUYj8TPypa1F_p-YW13jT2ewFGsxV2RqBU6rg',
  };


  const spreadsheetId = spreadsheetIds[language];
  console.log(spreadsheetId)
  if (!spreadsheetId) {
    throw new Error(`Invalid language code: ${language}`);
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8')),
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  const range = 'Sheet1!A:D'; // Range for columns A to D

  const service = google.sheets({ version: 'v4', auth });

  let rows;
  try {
    const result = await service.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    rows = result.data.values || [];
  } catch (error) {
    console.error('Error retrieving data:', error.message);
    throw error;
  }
  let totalAmount = 0;
  const productList = products.map(product => {
    const productID = product.product_retailer_id
    const productData = rows.find(row => row[0] === productID); // Assuming column A contains the product ID
    const productName = productData[3]
    const regex = /\[(\d+)\s*(?:Units?|यूनिट्स?|युनिट्स?|ইউনিটস?|ইউনিট)?\]/;
    const match = productName.match(regex);
    console.log("Match: ", match)
    let units = 1;
    if (match) {
      units = parseInt(match[1], 10); // Extract the number and convert it to an integer
      console.log("Units: ", units)
    }

    totalAmount += product.item_price * product.quantity * units
    if (productData) {
      return {
        id: product.id,
        name: productData[3],  
        quantity: product.quantity,
        unitPrice: product.item_price
      };
    }
    return null; 
  }).filter(item => item !== null); 

  totalAmount = Math.round(totalAmount * 100) / 100;
  totalAmount = Math.ceil(totalAmount);
  totalAmount = totalAmount.toFixed(2);


  const messages = {
    en: `Thank you for shopping with us! 🙏\n\n💰 *Total Amount:* *₹${totalAmount}*\n\n*Items Purchased:*\n${productList.map(item => `🔹 ${item.name} \n   Quantity: *${item.quantity}*  |  Unit Price: *₹${item.unitPrice}*`).join('\n\n')}\n\nPlease scan the QR code below to complete your payment. 👇`,
    
    hi: `हमारे स्टोर से खरीदारी करने के लिए धन्यवाद! 🙏\n\n💰 *कुल राशि:* *₹${totalAmount}*\n\n*खरीदी गई वस्तुएं:*\n${productList.map(item => `🔹 ${item.name} \n   मात्रा: *${item.quantity}*  |  यूनिट प्राइस: *₹${item.unitPrice}*`).join('\n\n')}\n\nकृपया भुगतान पूरा करने के लिए नीचे दिए गए QR कोड को स्कैन करें। 👇`,
  
    bn: `আমাদের স্টোর থেকে কেনাকাটা করার জন্য ধন্যবাদ! 🙏\n\n💰 *মোট পরিমাণ:* *₹${totalAmount}*\n\n*কেনা জিনিসপত্র:*\n${productList.map(item => `🔹 ${item.name} \n   পরিমাণ: *${item.quantity}*  |  একক দাম: *₹${item.unitPrice}*`).join('\n\n')}\n\nঅনুগ্রহ করে পেমেন্ট সম্পূর্ণ করতে নীচের QR কোডটি স্ক্যান করুন। 👇`,
  
    mr: `आमच्या स्टोअरवरून खरेदी केल्याबद्दल धन्यवाद! 🙏\n\n💰 *एकूण रक्कम:* *₹${totalAmount}*\n\n*खरेदी केलेली वस्तू:* \n${productList.map(item => `🔹 ${item.name} \n   प्रमाण: *${item.quantity}*  |  युनिट किमत: *₹${item.unitPrice}*`).join('\n\n')}\n\nकृपया पेमेंट पूर्ण करण्यासाठी खालील QR कोड स्कॅन करा. 👇`,
  };
  
  

  const textMessageData = {
    type: "text",
    text: {
      body: messages[language] || messages.en,
    },
  };
  sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, textMessageData, userSession.accessToken, userSession.tenant)
}


async function getNameById(spreadsheetId, range, targetId) {
  const auth = new GoogleAuth({
    keyFile: './nurenai-cef4f2574608.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
  });

  const service = google.sheets({ version: 'v4', auth });
  try {
    const result = await service.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = result.data.values || [];
    console.log(`${rows.length} rows retrieved.`);

    const matchingRow = rows.find((row) => parseInt(row[0]) === targetId);
    console.log("Matching Row: ", matchingRow)
    if (matchingRow) {
      const name = matchingRow[3];
      console.log(`Name for ID ${targetId}: ${name}`);
      return name;
    } else {
      console.log(`No row found with ID ${targetId}`);
      return null;
    }
  } catch (err) {
    console.error('Error retrieving data:', err);
    throw err;
  }
}

// // Example Usage
// (async () => {
//   const spreadsheetId = '1F_nEekNQfxPGkeqzSfQMHjXBF0VOfbfs-1uvN13oj0U'; // Replace with your Spreadsheet ID
//   const range = 'Sheet1!A:D'; // Replace with your range
//   const targetId = 300; // ID to search for

//   const name = await getNameById(spreadsheetId, range, targetId);
//   console.log('Result:', name);
// })()
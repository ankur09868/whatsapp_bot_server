import { getIndianCurrentTime, updateStatus, updateLastSeen, saveMessage, sendNotification, executeFallback, getSession  } from "../helpers/misc.js";
import { nurenConsumerMap, io, customWebhook } from "../server.js";
import { nuren_users } from "../helpers/order.js";
import { sendNodeMessage, sendTextMessage, sendProductMessage } from "../snm.js";
import { sendProduct } from "../helpers/product.js";
import { DRISHTEE_PRODUCT_CAROUSEL_IDS, handleCatalogManagement }  from "../drishtee.js"
import { sendMessage } from "../send-message.js";
import { handleMediaUploads } from "../helpers/handle-media.js";
import { languageMap } from "../dataStore/dictionary.js";
import { sendMessagetoConsumer, sendMessagetoRetailer, orderToDB } from "../helpers/order.js";
import { manualWebhook } from "./manualWebhook.js";
import axios from "axios";
import FormData from 'form-data';
import https from 'https';
import { financeBotWebhook } from "./financeBotWebhook.js";

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
    
    let timestamp = await getIndianCurrentTime()
    
    const repliedTo = message?.context?.id || null
    if (repliedTo !== null) updateStatus("replied", repliedTo, null, null, null, null, timestamp)
  
    let userSession = await getSession(business_phone_number_id, contact)
  
    if(userSession.type == "whatsapp"){
      manualWebhook(req, userSession)
      return res.sendStatus(200)
    }
    else if(userSession.type == 'finance'){
      return financeBotWebhook(req, res, userSession)
    }
  
    const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)

    if(message_text == "manual") {
      const nuren = nuren_users[userSession.tenant]
      userSession.type = "whatsapp"
      userSession["nuren"] = nuren
      nurenConsumerMap[nuren] = userSession.userPhoneNumber
      sendWelcomeMessage(userSession)
      return res.sendStatus(200)
    }
    else if(message_text == '/finance'){
      userSession.type = 'finance'
      return financeBotWebhook(req, res, userSession)
    }
  
    updateLastSeen("replied", timestamp, userSession.userPhoneNumber, userSession.business_phone_number_id)
  
    let formattedConversation = [{
      text: message_text,
      sender: "user"
    }];
    saveMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, formattedConversation, userSession.tenant, timestamp)
    
    const notif_body = {content: `${userSession.userPhoneNumber} | New meessage from ${userSession.userName || userSession.userPhoneNumber}: ${message_text}`, created_on: timestamp}
    sendNotification(notif_body, userSession.tenant)
    
    ioEmissions(message, userSession, timestamp)
  
    if (!userSession.multilingual){
  
      if (!userSession.AIMode) {
        handleInput(userSession, message)
      
        if (message?.type === "interactive") {
            let userSelectionID = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id;
  
            if (userSelectionID.split('_')[0] == 'drishtee') handleCatalogManagement(userSelectionID, userSession)
            else if(userSelectionID.includes('confirm') || userSelectionID.includes('cancel')) {
              handleOrderManagement(userSession, userSelectionID)
            }
            else{
              try {
                for (let i = 0; i < userSession.nextNode.length; i++) {
                    if (userSession.flowData[userSession.nextNode[i]].id == userSelectionID) {
                        userSession.currNode = userSession.nextNode[i];
                        userSession.nextNode = userSession.adjList[userSession.currNode];
                        userSession.currNode = userSession.nextNode[0];
                        sendNodeMessage(userSession.userPhoneNumber, userSession.business_phone_number_id);
                        break;
                    }
                };
                if(isNaN(userSelectionID)) await sendProduct(userSession, userSelectionID)
            } catch (error) {
                console.error('Error processing interactive message:', error);
            }}
        }
        else if (message?.type === "text" || message?.type == "image") {
            const flow = userSession.flowData
            const type = flow[userSession.currNode].type
            if (userSession.currNode != userSession.startNode){
                if (['Text' ,'string', 'audio', 'video', 'location', 'image', 'AI'].includes(type)) {
                    console.log(`Storing input for node ${userSession.currNode}:`, message?.text?.body);
                    userSession.currNode = userSession.nextNode[0];
                }
                else if(['Button', 'List'].includes(type)){
                    await executeFallback(userSession)
                    res.sendStatus(200)
                    return
                }
            }
            sendNodeMessage(userPhoneNumber,business_phone_number_id);
        }
        else if (message?.type =="order"){
          if(userSession.tenant == "leqcjsk") await processOrderForDrishtee(userSession, products)
          else await processOrder2(userSession, products)
          
          // userSession.currNode = userSession.nextNode[0];
          // console.log("Current node after processing order: ", userSession.currNode)
          // sendNodeMessage(userPhoneNumber,business_phone_number_id);
        }
        else if (message?.type == "button"){
          const userSelectionText = message?.button?.text
          console.log("User Selection Text: ", userSelectionText)
          if (DRISHTEE_PRODUCT_CAROUSEL_IDS.includes(userSelectionText)) await handleCatalogManagement(userSelectionText, userSession)
        }
        else if(message?.type == "audio"){
          if(userSession.tenant == 'leqcjsk') await handleAudioOrdersForDrishtee(message, userSession)

        }
      }
      else {
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
      if (message?.type === "text"){
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
      if (message?.type === "interactive") {
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
    res.sendStatus(200);
}

async function sendWelcomeMessage(userSession){
    const welcomeMessageForConsumer = "You are now connected to a human agent. Please type your message here and we will get back to you shortly."
    const welcomeMessageForRetailer = `${userSession.userName} has initiated a conversation with you. Please type your message here.`
  
    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: welcomeMessageForConsumer}}, userSession.accessToken, userSession.tenant)
    sendMessage(userSession.nuren, userSession.business_phone_number_id, {type: "text", text: {body: welcomeMessageForRetailer}}, userSession.accessToken, userSession.tenant)
}

async function processOrderForDrishtee(userSession, products) {
  const responseMessage_hi = "हमारी टीम को आपकी प्रतिक्रिया प्राप्त हो गई है। अब हम आपके ऑर्डर को प्लेस करने की प्रक्रिया को आगे बढ़ा रहे हैं।"
  const responseMessage_en = "Your response is received. Let's continue further process to place your order"
  const responseMessage_bn = "আপনার উত্তর পাওয়া গেছে। আসুন আপনার অর্ডার দেওয়ার পরবর্তী প্রক্রিয়া শুরু করি।"
  const responseMessage_mr = "आपला प्रतिसाद मिळाला आहे. चला, तुमची ऑर्डर देण्याची पुढील प्रक्रिया सुरू करूया."
  let responseMessage = responseMessage_en;

  const language = userSession.language

  if(language == "mr") responseMessage = responseMessage_mr
  else if(language == "bn") responseMessage = responseMessage_bn
  else if(language == "hi") responseMessage = responseMessage_hi

  // const failureMessage = userSession.language == "en" ? failureMessage_en: failureMessage_hi
  sendTextMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, responseMessage, userSession.accessToken, userSession.tenant)
  console.log("Products: ", products)
  const url = "https://testexpenses.drishtee.in/rrp/nuren/savePreOrder"
  const headers = {'Content-Type': 'application/json'}
  const data = {
    RRP_id: userSession.api.POST?.["RRP_ID"],
    products: products.map(product => {
      return {
        product_id: product.product_retailer_id,
        product_quantity: product.quantity
      }
    })
  }
  const response = await axios.post(url, data, {headers: headers})
  console.log("Response: ", response.data)
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

async function handleInput(userSession, message) {
  if (userSession.inputVariable !== undefined && userSession.inputVariable !== null && userSession.inputVariable.length > 0){

      // if (message?.type == "image" || message?.type == "document" || message?.type == "video") {
      //   console.log("Processing media message:", message?.type);
      //   const mediaID = message?.image?.id || message?.document?.id || message?.video?.id;
      //   console.log("Media ID:", mediaID);
      //   const doc_name = userSession.inputVariable
      //   try {
      //     console.log("Uploading file", userSession.tenant);
      //     await handleMediaUploads(userName, userPhoneNumber, doc_name, mediaID, userSession, tenant);
      //   } catch (error) {
      //     console.error("Error retrieving media content:", error);
      //   }
      //   console.log("Webhook processing completed successfully");
      // }
      // console.log(`Input Variable: ${userSession.inputVariable}`);
      // // console.log(`Input Variable Type: ${userSession.inputVariableType}`);
      // try{
      //   // let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
      
      //   // var validateResponse = await validateInput(userSession.inputVariable, userSelection)
        
      //   var validateResponse = "Yes"
      //   if(validateResponse == "No." || validateResponse == "No"){
      //     await executeFallback(userSession)
      //     res.sendStatus(200)
      //     return
      //   }else{
      //     let userSelection = message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || message?.text?.body;
      
      //     const updateData = {
      //       phone_no : userSession.userPhoneNumber,
      //       [userSession.inputVariable] : userSelection
      //     }
      //     const modelName = userSession.flowName
          
      //     addDynamicModelInstance(modelName , updateData, userSession.tenant)

      //     console.log(`Updated model instance with data: ${JSON.stringify(updateData)}`);
      //     console.log(`Input Variable after update: ${userSession.inputVariable}`);
      //   }
      // } catch (error) {
      //   console.error("An error occurred during processing:", error);
      // }

    const input_variable = userSession.inputVariable
    userSession.api.POST[input_variable] = message?.text?.body
    userSession.inputVariable = null
  }
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

async function handleAudioOrdersForDrishtee(message, userSession) {
  console.log("Received audio message: ", message)
  const mediaID = message?.audio?.id
  let response = await axios.get(`https://graph.facebook.com/v18.0/${mediaID}`, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}})
  const mediaURL = response.data.url
  response = await axios.get(mediaURL, {headers: {'Authorization': `Bearer ${userSession.accessToken}`}, responseType: 'arraybuffer'}) 
  const audioFile = response.data
  const formData = new FormData();
  formData.append('file', audioFile, 'audio.mp4');// Attach the file stream to FormData

  response = await axios.post(
    'https://webpbx.in/api/process/drishtee/product/search/',
    formData,
    {
      headers: { ...formData.getHeaders() }, // Include headers from FormData
      httpsAgent: agent,
    }
  );
  const product_list = response.data.data.data
  
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

  if(product_list.length>0){
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
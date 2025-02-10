
import { sendTextMessage, fastURL, djangoURL} from "../snm.js"
import { userSessions, messageCache } from "../server.js";
import axios from "axios";

const fallback_messages = {
    as: "দয়া করে সঠিক ইনপুট দিন",
    bh: "कृपया सही इनपुट दें",
    bn: "দয়া করে সঠিক ইনপুট দিন",
    gu: "કૃપા કરીને સahi ઇનપુટ આપો",
    hi: "कृपया सही इनपुट दें",
    kn: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಇನ್‌ಪುಟ್ ನೀಡಿರಿ",
    mr: "कृपया योग्य इनपुट द्या",
    or: "ଦୟାକରି ସଠିକ୍ ଇନପୁଟ୍ ଦିଅନ୍ତୁ",
    en: "Please try again"
}

export async function executeFallback(userSession){
    console.log("Entering Fallback")
    var fallback_count = userSession.fallback_count
    const userPhoneNumber = userSession.userPhoneNumber
    const business_phone_number_id = userSession.business_phone_number_id

    if(fallback_count > 0){
        console.log("Fallback Count: ", fallback_count)
        const fallback_msg = userSession.language == null ? userSession.fallback_msg : fallback_messages?.[`${userSession.language}`]
        console.log("Fallback Message: ", fallback_msg)
        const access_token = userSession.accessToken
        const response = await sendTextMessage(userPhoneNumber, business_phone_number_id, fallback_msg, access_token)
        fallback_count=fallback_count - 1;
        userSession.fallback_count = fallback_count
    }
    else{
        userSessions.delete(userPhoneNumber+business_phone_number_id)
        console.log("restarting user session for user: ", userPhoneNumber)
    }
}

export async function addContact(phone, name, bpid) {
    try{
        const c_data = {
            name: name,
            phone: phone
        }
        await axios.post(`${djangoURL}/contacts_by_tenant/`, c_data, {
        headers: {'bpid': bpid}
        })
    }catch (error){ 
        console.error('Error Occured while adding contact: ', error.message)
    }
}

export async function addDynamicModelInstance(modelName, updateData, tenant) {
    const url = `${djangoURL}/dynamic-model-data/${modelName}/`;
    const data = updateData;
    try {
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenant
            },
        });
        console.log('Data updated successfully:', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`Failed to add dynamic model instance: ${error.response.status}`, JSON.stringify(error.response.data, null, 5));
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error in setting up the request:', error.message);
        }
        return null;
    }
}

// export async function replacePlaceholders(message, userSession) {
//     const placeholders = [...message.matchAll(/{{\s*[\w._\[\]]+\s*}}/g)] || [];
//     if(placeholders && placeholders.length > 0){
//         console.log("Placeholders: ", placeholders)
//         for (const placeholder of placeholders){
//             let key = placeholder[0].slice(2, -2).trim();
//             var url = `${djangoURL}/contacts-by-phone/${userSession.userPhoneNumber}`;
//             const tenant_id = userSession.tenant
//             try {
//                 const response = await axios.get(url, {
//                     headers: {
//                         "X-Tenant-Id": tenant_id
//                     }
//                 });
//                 const responseData = response.data?.[0]
//                 console.log("response : " ,responseData)
                
//             } catch (error) {
//                 console.error('Error fetching data for placeholder replacement:', error);

//             }
//         }
//     }
// }

export async function replacePlaceholders(message, userSession = {}, contact = null, tenant = null) {
    
    console.log("message b4 replacement: ", message)
    const placeholders = [...message.matchAll(/{{\s*[\w._\[\]]+\s*}}/g)] || [];

    if(userSession && !contact) contact = userSession.userPhoneNumber
    if(userSession && !tenant) tenant = userSession.tenant

    if(placeholders && placeholders.length > 0){
        console.log("Placeholders: ", placeholders)
        for (const placeholder of placeholders){
            let key = placeholder[0].slice(2, -2).trim();
            const keys = key.split('.')
            if(keys[0] == 'contact'){
                let contactData = messageCache.get(contact)
                if(!contactData){
                    const response = await axios.get(`${djangoURL}/contacts-by-phone/${contact}`, {headers: {'X-Tenant-Id': tenant}})
                    contactData = response.data[0]
                    console.log("Received Data: ", contactData)
                    messageCache.set(contact, contactData)
                }
                if (keys.length > 1) {
                    const keyPlaceholder = keys[1];
                    const replacementValue = contactData?.[keyPlaceholder] !== undefined ? contactData[keyPlaceholder] : '';
                    message = message.replace(placeholder[0], replacementValue);
                } else {
                    console.warn("Invalid contact placeholder: ", placeholder[0]);
                }
            }
            else if(keys[0] =='api'){
                const data_source = userSession.api.GET
                const nestedKeyPath = keys.slice(1).join('.');
                const replacementValue = await getNestedValue(data_source, nestedKeyPath) || '';

                message = message.replace(placeholder[0], replacementValue);
            }
            else{
                console.log("Unrecognized Placeholder: ", keys[0])
            }
        }
    }
    console.log("MEssage after replacing: " ,message)
    return message;
}

async function getNestedValue(obj, keyPath) {
    if (!obj || !keyPath || typeof keyPath !== 'string') {
        return undefined; // Return undefined if obj or keyPath is invalid
    }

    // Split the key path into parts (e.g., "responseData1.user.name" -> ["responseData1", "user", "name"])
    const keys = keyPath.split('.');

    // Traverse the object to get the value
    let current = obj;
    for (const key of keys) {
        if (current[key] === undefined) {
            return undefined; // Key not found
        }
        current = current[key];
    }

    return current;
}

export async function  updateStatus(status, message_id, business_phone_number_id, user_phone, broadcastGroup, tenant, timestamp) {
let isRead = false;
let isDelivered = false;
let isSent = false;
let isReplied = false;
let isFailed = false;
console.log("Sending message status: ", status)
try {
    if (status === "replied"){
    isReplied = true;
    } else if (status === "read") {
    isRead = true;
    } else if (status === "delivered") {
    isDelivered = true;
    } else if (status === "sent") {
    isSent = true;
    } else if (status === "failed"){
    isFailed = true;
    }

    // Prepare data to send
    const data = {
        business_phone_number_id: business_phone_number_id,
        is_failed: isFailed,
        is_replied: isReplied,
        is_read: isRead,
        is_delivered: isDelivered,
        is_sent: isSent,
        user_phone: user_phone,
        message_id: message_id,
        bg_id : broadcastGroup?.id,
        bg_name : broadcastGroup?.name,
        template_name : broadcastGroup?.template_name,
        timestamp: timestamp
    };
    // console.log("Tenant Sent: ", tenant)
    // console.log("Sending request with data:", data);

    // Send POST request with JSON payload
    console.log("Sending req to set status")
    const response = await axios.post(`${djangoURL}/set-status/`, data, {
    headers: { 
        "X-Tenant-Id": tenant, 
        "Content-Type": "application/json" 
    }
    });
    // const new_response = await axios.post(`http://localhost:8001/test/`, data, {
    //     headers: {
    //         "X-Tenant-Id": tenant, 
    //         "Content-Type": "application/json" 
    //     }
    //     });

    console.log("Response received in set-status:", response.data);
} catch (error) {
    console.error("Error updating status:", error.response ? error.response.data : error.message);
}
}

export async function validateInput(inputVariable, message){
try{
const prompt = `Question being asked is: ${inputVariable}?\n
Response being given is: ${message}\n
Does the response answer the question? reply in yes or no. nothing else `

const api_key = process.env.OPENAI_API_KEY;

const data = {
    model: "gpt-4o-mini",
    messages : [
    {
        role: "system",
        content: "you are a helpful assisstant who replies in yes or no only"
    },
    {
        role: "user",
        content: prompt
    }
    ]
}
const response = await axios.post('https://api.openai.com/v1/chat/completions',data, {
    headers: {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json',
    }
});

const validationResult = response.data.choices[0].message.content;
console.log("Validation Result: ", validationResult)
return validationResult
} catch (error) {
console.error('Error validating input:', error);
return false;
}
}

export async function getTenantFromBpid(bpid) {
    try{
        var response = await axios.get(`${djangoURL}/get-tenant/?bpid=${bpid}`, {
        })
        // console.log("Tenant Response: ", response.data)
        const tenant = response.data.tenant
        return tenant
    }catch(error){
        console.error(`Error getting tenant for ${bpid}: `, error)
    }
}

export async function saveMessage(userPhoneNumber, business_phone_number_id, formattedConversation, tenant, timestamp) {
    try {
        
        const body = {
            contact_id: userPhoneNumber,
            business_phone_number_id: business_phone_number_id,
            conversations: formattedConversation,
            tenant: tenant,
            time: timestamp
        }

        axios.post(`${djangoURL}/whatsapp_convo_post/${userPhoneNumber}/?source=whatsapp`,body,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenant
                }
            }
        );
        // if (!saveRes.ok) throw new Error("Failed to save conversation");
      } catch (error) {
        console.error("Error saving conversation (save message):", error.message);
      }
}

export async function sendNotification(notif, tenant){
    try{
        await axios.post(`${fastURL}/notifications`, notif,
            {
                headers: {
                    'X-Tenant-Id': tenant
                }
            }
        )
        // console.log("Response Sending Notification: ", res.data)
    }
    catch (error){
        console.error(`Error sending notification: ${error}`)
    }
}

export async function updateLastSeen(type, time, phone, bpid) {
    try{
        const response = await axios.patch(`${djangoURL}/update-last-seen/${phone}/${type}`, {time: time}, {headers: {bpid: bpid}})

        console.log("Response updating last seen: ", response.data)
    } catch (error){
        console.error("Error Occured in updating last seen: ", error)
    }
}

export async function getIndianCurrentTime(){

    const current_time = new Date()
    
    const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    };
    
    const indiaTime = new Intl.DateTimeFormat('en-GB', options).format(current_time);
    console.log("India Time: ", indiaTime)
    return indiaTime
}

export async function getSession(business_phone_number_id, contact) {
    try{
        console.log("Contact: " ,contact)
        const userPhoneNumber = contact?.wa_id
        const userName = contact?.profile?.name || "Nuren User"
      
        let userSession = userSessions.get(userPhoneNumber+business_phone_number_id);
      
        if (!userSession) {
          
            addContact(userPhoneNumber, userName, business_phone_number_id)
            console.log(`Creating new session for user ${userPhoneNumber}`);
            try {
                let responseData = messageCache.get(business_phone_number_id)
                if(!responseData){
                    const response = await axios.get(`${fastURL}/whatsapp_tenant`,{
                        headers: {'bpid': business_phone_number_id}
                    });
                    responseData = response.data
                    messageCache.set(business_phone_number_id, responseData)
                }
                console.log("Tenant data received:", responseData);
                const responseFlowData = responseData?.whatsapp_data
                let multilingual = responseData?.whatsapp_data[0].multilingual;
                let flowData;
                if (multilingual) flowData = responseData?.whatsapp_data
                else flowData = responseData?.whatsapp_data[0].flow_data
                
                const adjList = responseData?.whatsapp_data[0]?.adj_list
                const startNode = responseData?.whatsapp_data[0]?.start !== null ? responseData?.whatsapp_data[0]?.start : 0;
                const currNode = startNode
                // const multilingual = flowData.length > 1 ? true : false
                if(!flowData && !adjList) console.error("Flow Data is not present for bpid: ", business_phone_number_id)
                userSession = {
                    type: "chatbot",
                    AIMode: false,
                    lastActivityTime: Date.now(),
                    flowData: flowData || [],
                    adjList: adjList || [],
                    accessToken: responseData.whatsapp_data[0].access_token,
                    accountID: responseData.whatsapp_data[0].business_account_id,
                    flowName : responseData.whatsapp_data[0].flow_name || "",
                    startNode : startNode,
                    currNode: currNode, 
                    nextNode: adjList?.[currNode] || [],
                    business_phone_number_id: responseData.whatsapp_data[0].business_phone_number_id,
                    tenant : responseData.whatsapp_data[0].tenant_id,
                    userPhoneNumber : userPhoneNumber,
                    userName: userName,
                    inputVariable : null,
                    inputVariableType: null,
                    fallback_msg : responseData.whatsapp_data[0].fallback_message || "please provide correct input",
                    fallback_count: responseData.whatsapp_data[0].fallback_count != null ? responseData.whatsapp_data[0].fallback_count : 1,
                    products: responseData.catalog_data,
                    language: "en",
                    multilingual: multilingual,
                    doorbell: responseData.whatsapp_data[0]?.introductory_msg || null,
                    api:  {
                        POST: {},
                        GET: {}
                    },
                    agents: responseData.whatsapp_data[1]?.agents
                };
        
                const key = userPhoneNumber + business_phone_number_id
                
                userSessions.set(key, userSession);
            } catch (error) {
            console.error(`Error fetching tenant data for user ${userPhoneNumber}:`, error);
            throw error;
            }
        } else {
            userSession.lastActivityTime = Date.now()
            if(userSession.currNode != null) userSession.nextNode = userSession.adjList[userSession.currNode]
            else {
                userSession.currNode = userSession.startNode
                userSession.nextNode = userSession.adjList[userSession.currNode]
            }
        }
        return userSession;
    }catch(error){
        console.error("Error in getSession: ", error);
        throw new Error(`Session initialization failed: ${error.message}`)
    }
}

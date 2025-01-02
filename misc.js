
import { sendTextMessage, fastURL, djangoURL} from "./snm.js"

import { userSessions } from "./server.js";
import axios from "axios";

const fallback_messages = {
    as: "দয়া করে সঠিক ইনপুট দিন",
    bh: "कृपया सही इनपुट दें",
    bn: "দয়া করে সঠিক ইনপুট দিন",
    gu: "કૃપા કરીને સahi ઇનપુટ આપો",
    hi: "कृपया सही इनपुट दें",
    kn: "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಇನ್‌ಪುಟ್ ನೀಡಿರಿ",
    mr: "कृपया योग्य इनपुट द्या",
    or: "ଦୟାକରି ସଠିକ୍ ଇନପୁଟ୍ ଦିଅନ୍ତୁ"
}

export async function executeFallback(userSession){
    console.log("Entering Fallback")
    var fallback_count = userSession.fallback_count
    const userPhoneNumber = userSession.userPhoneNumber
    const business_phone_number_id = userSession.business_phone_number_id

    if(fallback_count > 0){
        console.log("Fallback Count: ", fallback_count)
        const fallback_msg = userSession.language == null ? userSession.fallback_msg : fallback_messages?.[`${userSession.language}`]
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

export async function addContact(phone, name, tenant) {
    try{
        console.log(`Saving ${name} with phone ${phone} under tenant ${tenant} to DB`)
        const c_data = {
            name: name,
            phone: phone
        }
        await axios.post(`${djangoURL}/contacts_by_tenant/`, c_data, {
        headers: {'X-Tenant-Id': tenant}
        })
    }catch (error){
        console.error('Error Occured while adding contact: ', error.message)
    }
}

export async function addDynamicModelInstance(modelName, updateData, tenant) {
    const url = `${djangoURL}/dynamic-model-data/${modelName}/`;
    const data = updateData;
    // console.log("DATAAAAAAAAAAAAAAAAAAAAAAA: ", data)
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
            console.error(`Failed to add dynamic model instance: ${error.response.status}, ${error.response.data}`);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error in setting up the request:', error.message);
        }
        // console.error('Config details:', error.config);
        return null;
    }
}

export async function replacePlaceholders(message, userSession, api_placeholders, contact_placeholders) {
    
    console.log("message b4 replacement: ", message) 

    
        // const placeholders = [...message.matchAll(/{{\s*[\w]+\s*}}/g)];
        
    if(contact_placeholders && contact_placeholders.length > 0){
        console.log("Contact Placeholders: ", contact_placeholders)
        for (const placeholder of contact_placeholders) {
            let key = placeholder[0].slice(2, -2).trim();
            console.log("key:", key)
            if(['id', 'name', 'phone', 'createdOn', 'isActive', 'bg_id', 'bg_name', 'tenant'].includes(key))
            {
                var url = `${djangoURL}/contacts-by-phone/${userSession.userPhoneNumber}`;
                const tenant_id = userSession.tenant
                try {
                    const response = await axios.get(url, {
                        headers: {
                            "X-Tenant-Id": tenant_id
                        }
                    });
                    const responseData = response.data?.[0]
                    console.log("response : " ,responseData)
                    const replacementValue = responseData?.[key] !== undefined ? responseData[key] : '';

                    message = message.replace(placeholder[0], replacementValue);
                    
                } catch (error) {
                    console.error('Error fetching data for placeholder replacement:', error);

                }
            }
        }
    }

    api_placeholders = [...message.matchAll(/{{\s*[\w._\[\]]+\s*}}/g)] || []; 
    
    if(api_placeholders && api_placeholders.length>0){
        console.log("placeholders: ", api_placeholders)

        for (const placeholder of api_placeholders) {
            const key = placeholder[0].slice(2, -2).trim();
            console.log("ey: ", key);

            const value = key.split('.').reduce((acc, part) => {
                if (part.includes('[')) {
                    const [arrayKey, index] = part.split('[');
                    const cleanIndex = index.replace(']', ''); 
                    const acc_list = acc?.[arrayKey];
                    const flow_data = acc_list[parseInt(cleanIndex)]
                    return flow_data; 
                }
                return acc?.[part]; 
            }, userSession.api.GET);
            // const value = userSession.api.GET?.[key]

            console.log("Value: ", value);

            
            if (value !== undefined) {
                message = message.replace(placeholder[0], value);
            }
        }
    }

console.log("MEssage after replacing: " ,message)

return message;
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
import { setTemplate, messageCache } from "../server.js";
import { sendMessage } from "../send-message.js";
import { convertImageToBase64 } from "../flowsAPI/flow.js";
import axios from "axios"

export async function promptWebhook(req, res, userSession) {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;
    const userName = contact?.profile?.name || null
    console.log("Entering Prompt Webhook")
    
    const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)

    if(message_text == '/prompt'){
        sendPromptGreetingMessage(userSession)
    }else
    if(message?.type == "interactive"){
        const nfm_reply = message?.interactive?.nfm_reply
        let responses = nfm_reply?.response_json
        // console.log("Responses: ",typeof responses)
        responses = JSON.parse(responses)
        console.log("Responseseseses: ", responses)
        const nfm_type = responses?.type

        switch(nfm_type){
            case "PROMPT":
                handlePrompt(userSession, responses)
                break;
            default:
                console.log("Unhandled nfm type: ", nfm_type)
        }
    }
    res.sendStatus(200)
}

async function sendPromptGreetingMessage(userSession) {
    let messageData;

    messageData = {
        type: "text",
        text: {body: "Hello! Welcome to Prompt Bot. "}
    }
    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)

    messageData = await flowData(
        "Generate Prompt",
        "Craft the perfect prompt effortlessly! Share a few basic details about your requirements, and we’ll generate a refined, ready-to-use prompt for you.\n\nLet’s get started and unlock your creativity!\n\n*Get Started Now!*",
        {
            screen: "WELCOME",
            data: {
                image: await convertImageToBase64("./webhooks/nurenai image.jpg"),
            }
        },
        "Custom Bot"
    );
    // const payload = {
    //     screen: "DATA_COLLECTION"
    // }
    // messageData = await flowData("Enter Details", "We also offer expert reccommendations based on your portfolio. Please fill out these details:", payload);

    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)

}

async function flowData(cta, body, payload, flow_name) {
    try{
        const messageData =  {
            "type": "interactive",
            "interactive": {
                "type": "flow",
                "body": {
                    "text": body
                },
                "action": {
                    "name": "flow",
                    "parameters":{
                        "flow_message_version": "3",
                        "flow_token": "COOL",
                        "flow_name": flow_name,
                        "flow_cta": cta,
                        "flow_action": "navigate",
                        "flow_action_payload": payload
                    }
                }
            }
        }
        return messageData
    }catch(err){
        console.error("Error in flowData(): ", err)
    }
}

async function handlePrompt(userSession, responses) {
    if(responses?.id) responses = getTopicDetails(responses?.id, responses?.platform)
        console.log("Responses: " ,responses)
    const link = await generateUrl(responses?.topic, responses?.focus, responses?.context, responses?.platform)
    const templateName = "prompt";
    const cacheKey = `${userSession.accountID}_${templateName}`;
    let templateDetails = messageCache.get(cacheKey);

    if (!templateDetails) {
        const response = await axios.get(
        `https://graph.facebook.com/v16.0/${userSession.accountID}/message_templates?name=${templateName}`,
        { headers: { Authorization: `Bearer ${userSession.accessToken}` } }
        );
        // console.log("Response: ", response.data);
        templateDetails = response.data.data[0];
        messageCache.set(cacheKey, templateDetails);
    }

    const contact = userSession.userPhoneNumber

    const messageData = await setTemplate(templateDetails, contact, userSession.business_phone_number_id, userSession.accessToken, userSession.tenant, null, link);
    // console.log("Message Data: ", messageData)
    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
}

async function generateUrl(topic, main_focus, context, platform) {
    console.log("rcvd data: ", topic, main_focus, context, platform)
    const query = `Create a ${platform} post that effectively engages your audience on the topic of {${topic}}, highlighting {${main_focus}} in {${context}}. 
        Instructions: Return only the post content. 
        Steps
        1. Introduction: Start with a compelling hook that captures attention. Mention the significance of {${main_focus}} in {${context}}.
        2. Main Content: Discuss the potential of {${topic}} and how it can enhance user experience. Highlight specific benefits or use cases.
        3. Call to Action: Encourage engagement by asking a question or inviting opinions on the topic.
        4. Conclusion: Summarize the key points`;

    let encodedQuery = encodeURIComponent(query);
    
    return encodedQuery;
}

function getTopicDetails(id,  platform) {
    const dataSource = [
        {
            id: "1",
            title: "Televisions",
            description: "Context: Use of TVs is declining due to the rise of alternative devices.",
            metadata: "Focus: Screens"
        },
        {
            id: "2",
            title: "Artificial Intelligence",
            description: "Context: AI is transforming industries by automating tasks and improving efficiency.",
            metadata: "Focus: Ethics"
        },
        {
            id: "3",
            title: "Climate Change",
            description: "Context: Global warming is causing extreme weather patterns and rising sea levels.",
            metadata: "Focus: Renewables"
        },
        {
            id: "4",
            title: "Remote Work",
            description: "Context: The pandemic has accelerated the adoption of remote work globally.",
            metadata: "Focus: Balance"
        },
        {
            id: "5",
            title: "Electric Vehicles",
            description: "Context: EVs are gaining popularity as a sustainable alternative to traditional cars.",
            metadata: "Focus: Batteries"
        },
        {
            id: "6",
            title: "Mental Health",
            description: "Context: Awareness about mental health is increasing, leading to better support systems.",
            metadata: "Focus: Therapy"
        },
        {
            id: "custom",
            title: "Custom",
            description: "Create your own topic, define the main focus, and provide context for your post."
        }
    ];

    const selectedItem = dataSource.find(item => item.id === id);

    if (selectedItem) {
        const topic = selectedItem.title;
        const focus = selectedItem.metadata ? selectedItem.metadata.replace("Focus: ", "") : null;
        const context = selectedItem.description ? selectedItem.description.replace("Context: ", "") : null;

        return { topic, focus, context, platform };
    } else {
        return null;
    }
}

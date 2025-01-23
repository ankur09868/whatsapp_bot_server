import { sendMessage } from "../send-message.js";
import axios from "axios";
import { convertImageToBase64 } from "../flowsAPI/flow.js";
import FormData from 'form-data';



// const url = 'https://x01xx96q-8000.inc1.devtunnels.ms'
// const url = 'http://localhost:8002'
const url = 'https://mfcentral-hfckakhnbqe0h6gp.canadacentral-01.azurewebsites.net'

export async function financeBotWebhook(req, res, userSession) {
    const business_phone_number_id = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const userPhoneNumber = contact?.wa_id || null;
    const userName = contact?.profile?.name || null
    
    
    const message_text = message?.text?.body || (message?.interactive ? (message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title) : null)

    if(message_text == '/finance'){
        sendGreetingMessage(userSession)
    }
    if(message?.type == "interactive"){
        const nfm_reply = message?.interactive?.nfm_reply
        let responses = nfm_reply?.response_json
        // console.log("Responses: ",typeof responses)
        responses = JSON.parse(responses)
        console.log("Responseseseses: ", responses)
        const nfm_type = responses?.type

        switch(nfm_type){
            case "LOGIN":
                handleLogin(userSession, responses)
                break;
            case "SIGNUP":
                handleSignup(userSession, responses)
                break;
            case "OTP":
                handleOTP(userSession, responses)
                break;
            case "SEC_QUESTION":
                handleSecQuestion(userSession, responses)
                break;
            case "REGISTER":
                handleRegister(userSession, responses)
                break;
            case "QUESTIONS":
                handleQuestions(userSession, responses)
                break;
            case "DATA_COLLECTION":
                handleDataCollection(userSession, responses)
                break;
            default:
                console.log("Unhandled nfm type: ", nfm_type)
        }

    }
    res.sendStatus(200)
}

async function sendGreetingMessage(userSession) {
    let messageData;

    messageData = {
        type: "text",
        text: {body: "Hello! Welcome to financeBot."}
    }
    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)

    messageData = await flowData("Sign In", "Get all your portfolio info just in a few clicks!!", {screen: "WELCOME", data: {image: await convertImageToBase64("./flowsAPI/login-form-2.png")}})
    // const payload = {
    //     screen: "DATA_COLLECTION"
    // }
    // messageData = await flowData("Enter Details", "We also offer expert reccommendations based on your portfolio. Please fill out these details:", payload);

    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleLogin(userSession, responses) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',  // Add Accept header for consistency
            // 'Cookie': '.Tunnels.Relay.WebForwarding.Cookies=YourCookieHere', // Replace with actual cookie if needed
        };
        const data = {
            pan: responses?.pan,
            password: responses?.password,
            key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`,
        };

        console.log('Request data:', data);
        console.log('Request URL:', `${url}/signin`);

        const secquestionpromise = fetch(`${url}/signin`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
        });

        let messageData;

        messageData = {
            type: 'text',
            text: { body: 'Received your credentials.' },
        };
        await sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);

        messageData = {
            type: 'text',
            text: { body: 'Logging you in....' },
        };
        await sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);

        const secquestionresponse = await secquestionpromise;


        const rawResponse = await secquestionresponse.text(); // Get the raw response as text
        console.log('Raw response:', rawResponse);
        // const secquestiondata = {question: "What is first phoone?"}
        let secquestiondata;
        console.log("Sec Question Response: ", secquestionresponse)
        if (rawResponse) {
            secquestiondata = JSON.parse(rawResponse); // Parse if valid JSON
        }
        const success = secquestiondata?.success

        if(success == true){
            const question = secquestiondata?.question;

            const payload = {
                screen: 'SECURITYQUESTION',
                data: {
                    question: question,
                },
            };
    
            messageData = await flowData(
                'Security Question',
                'Please answer the security question to login:',
                payload
            );
            console.log('Message data: ', messageData);
    
            sendMessage(
                userSession.userPhoneNumber,
                userSession.business_phone_number_id,
                messageData,
                userSession.accessToken,
                userSession.tenant
            );
        }else if(success == false){
            const message = secquestiondata?.message || "";

            let messageData = {
                type: "text",
                text: { body: "Some error occured, please sign in again."}
            };
            sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);

            messageData = {
                type: "text",
                text: { body: message}
            };
            sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);
                        
            messageData = await flowData("Sign In", "Get all your portfolio info just in a few clicks!!", {screen: "LOGIN"})
            sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant)
        }

    } catch (err) {
        console.error('Error in handleLogin(): ', err);
    }
}

async function handleSecQuestion(userSession, responses) {
    try {
        const headers = { key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}` };
        const data = { userAnswer: responses?.answer };

        const promise = fetch(`${url}/submit`, {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data),
            timeout: 300000
        });

        let messageData = {
            type: "text",
            text: { body: "Extracting Portfolio..." }
        };

        sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);

        const response = await promise;
        // const responseData = { portfolio: {soaData: [], dematData: []}}


        const responseData = await response.json();
        console.log("RESPONSE PORT: ", JSON.stringify(responseData, null, 6));

        const portfolio = responseData.portfolio;
        const portfolioTable = await generateMarkdownTable(portfolio);

        let payload = {
            screen: "PORTFOLIO",
            data: {
                array: portfolioTable
            }
        };

        messageData = await flowData("View Portfolio", "Your portfolio has been generated. Click to see.", payload);
        await sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);
        payload = {
            screen: "DATA_COLLECTION"
        }
        messageData = await flowData("Enter Details", "We also offer expert reccommendations based on your portfolio. Please fill out these details:", payload);
        sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, userSession.tenant);
    } catch (err) {
        console.error("Error in handleSecQuestion(): ", err);
    }
}

async function generateMarkdownTable(portfolio) {
    // Define a helper function to generate a table for a single dataset
    function processPortfolioData(data, title) {
        const header = "| Company Name       | Holding Percentage      | Invested Value       | Market Value       | Gain/Loss        |";
        const divider = "|-------------------|-------------------------|---------------------|-------------------|----------------|";

        let totalInvestedValue = 0;
        let totalMarketValue = 0;
        let totalGainLoss = 0;

        const rows = data.map((entry) => {
            const investedValue = parseFloat(entry.investedValue.replace(/[^0-9.-]+/g, ""));
            const marketValue = parseFloat(entry.marketValue.replace(/[^0-9.-]+/g, ""));
            const gainLoss = parseFloat(entry.gainLoss.replace(/[^0-9.-]+/g, ""));

            totalInvestedValue += investedValue;
            totalMarketValue += marketValue;
            totalGainLoss += gainLoss;

            return `| ${entry.companyName.padEnd(17)} | ${entry.holdingPercentage.padEnd(24)} | ${entry.investedValue.padEnd(21)} | ${entry.marketValue.padEnd(19)} | ${entry.gainLoss.padEnd(16)} |`;
        });

        const summary = [
            `**${title} Summary**`,
            `+ **Total Invested Value**: ₹${totalInvestedValue.toLocaleString()}`,
            `+ **Total Market Value**: ₹${totalMarketValue.toLocaleString()}`,
            `+ **Total Gain/Loss**: ₹${totalGainLoss.toLocaleString()}`
        ];

        return [header, divider, ...rows, ...summary];
    }

    const soaTable = processPortfolioData(portfolio.soaData, "SOA");
    const dematTable = processPortfolioData(portfolio.dematData, "Demat");

    return [
        "## SOA",
        ...soaTable,
        "\n## Demat",
        ...dematTable
    ];
}

async function flowData(cta, body, payload) {
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
                        "flow_name": "Finance Bot",
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

async function handleSignup(userSession, responses) {
    try {
        const data = {
            pan: responses?.pan,
            mobile: responses?.phone,
            key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`
        };

        const response = await fetch(`${url}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });


        let messageData = {
            type: "text",
            text: { body: "We've sent a One-Time Password on your mobile number." }
        };

        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

        const payload = {
            screen: "ENTEROTP"
        };

        messageData = await flowData("Enter OTP", "Enter the OTP below:", payload);

        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

    } catch (err) {
        console.error("Error in handleSignup(): ", err);
    }
}
  
async function handleOTP(userSession, responses) {
    try {
        const headers = {
            "Content-Type": "application/json",
            key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`
        };
        const data = { otp: responses?.otp };

        const response = await fetch(`${url}/verify-otp`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(data)
        });


        // const responseData = {success: true}

        const responseData = await response.json();

        let messageData;

        if (!responseData.success) {
            messageData = {
                type: "text",
                text: { body: "You've entered the incorrect OTP." }
            };
            await sendMessage(
                userSession.userPhoneNumber,
                userSession.business_phone_number_id,
                messageData,
                userSession.accessToken,
                userSession.tenant
            );

            const payload = {
                screen: "ENTEROTP"
            };

            messageData = await flowData("Enter OTP", "Please enter the correct OTP:", payload);
            await sendMessage(
                userSession.userPhoneNumber,
                userSession.business_phone_number_id,
                messageData,
                userSession.accessToken,
                userSession.tenant
            );
        } else {
            messageData = {
                type: "text",
                text: { body: "Phone Number Verified!" }
            };
            await sendMessage(
                userSession.userPhoneNumber,
                userSession.business_phone_number_id,
                messageData,
                userSession.accessToken,
                userSession.tenant
            );

            const payload = {
                screen: "REGISTER"
            };

            messageData = await flowData("Register", "Register yourself with us to enjoy benefits:", payload);
            await sendMessage(
                userSession.userPhoneNumber,
                userSession.business_phone_number_id,
                messageData,
                userSession.accessToken,
                userSession.tenant
            );
        }
    } catch (err) {
        console.error("Error in handleOTP(): ", err);
    }
}

async function handleRegister(userSession, responses) {
    const headers = {key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`}
    const data = {displayName: responses?.name, password: responses?.password, confirmPassword: responses?.password}
    const response = await axios.post(`${url}/set-password`, data, {headers: headers})
    // const response = {data: true}
    let messageData;
    if(response.data){
        messageData = {
            type: "text",
            text: { body: "You need to answer some security questions for registration.." }
        };
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

        const payload = {
            screen: "SECURITY"
        };

        messageData = await flowData("Security Questions", "Please answer these security questions:", payload);
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );
    }
    else{
        messageData = {
            type: "text",
            text: { body: "There has been some error in the registration process." }
        };
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

        const payload = {
            screen: "REGISTER"
        };

        messageData = await flowData("Register", "Kindly register again:", payload);
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );
    }
}

async function handleQuestions(userSession, responses) {
    console.log("Responses rcvd: ", responses)
    const headers = {key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`}
    const data = {
        questions: [
            {questionValue: "2", answer: responses["2"]},
            {questionValue: "3", answer: responses["3"]},
            {questionValue: "5", answer: responses["5"]},
            {questionValue: "6", answer: responses["6"]},
            {questionValue: "8", answer: responses["8"]},
        ]
    }
    const response = await axios.post(`${url}/security-questions`, data, {headers: headers})
    // const response = {success: true}
    let messageData;
    if(response.success){
        
        messageData = {
            type: "text",
            text: { body: "You've been successfully registered!" }
        };
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

        const payload = {
            screen: "LOGIN"
        };

        messageData = await flowData("Log In", "Please login to view your portfolio:", payload);
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );
    }else{
        messageData = {
            type: "text",
            text: { body: "There has been some error in the process." }
        };
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );

        const payload = {
            screen: "SECURITY"
        };

        messageData = await flowData("Security Questions", "Please answer these security questions again:", payload);
        await sendMessage(
            userSession.userPhoneNumber,
            userSession.business_phone_number_id,
            messageData,
            userSession.accessToken,
            userSession.tenant
        );
    }
}

async function handleDataCollection(userSession, responses) {
    const headers = {key: `${userSession.business_phone_number_id}_${userSession.userPhoneNumber}`}
    const data = {
        age: responses?.age_group,
        risk: responses?.risk_tolerance,
        goals: responses?.goal
    }
    const response = await axios.post('https://x01xx96q-8000.inc1.devtunnels.ms/evalution', data, {headers: headers})
    console.log("Response rcvd in data collection: ", response.data)
    const base64Image = response.data.image
    const base64Data = base64Image.split(';base64,').pop();
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const formData = new FormData();
    formData.append('file', imageBuffer, { filename: 'image.png' });
    formData.append('type', 'image');
    formData.append('messaging_product', 'whatsapp');
    let mediaID;
    try {
        const mediaResponse = await axios.post(
            `https://graph.facebook.com/v16.0/${userSession.business_phone_number_id}/media`,
            formData,
            {
            headers: {
                ...formData.getHeaders(), // Include FormData headers
                Authorization: `Bearer ${userSession.accessToken}`,
            },
            }
        );
        console.log("Response: ", mediaResponse.data)
        console.log('Media ID:', mediaResponse.data.id);
        mediaID = mediaResponse.data.id
    } catch (error) {
        console.error('Error uploading image:', error.response?.data || error.message);
    }
    
    const messageData = {
        type: "image",
        image: {
            id: mediaID,
            caption: response.data.analysis
        }
    };
    await sendMessage(
        userSession.userPhoneNumber,
        userSession.business_phone_number_id,
        messageData,
        userSession.accessToken,
        userSession.tenant
    );
}
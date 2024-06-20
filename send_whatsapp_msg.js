
import axios from "axios";
import {addConversation, conversationData} from "./app.js";
const WEBHOOK_VERIFY_TOKEN = "COOL";

const GRAPH_API_TOKEN = process.env.GRAPH_API_TOKEN;

const GPT_API_KEY = process.env.REACT_APP_OPENAI_KEY;

async function sendWhatsappMessage(phoneNumber, message) {
  const url = "https://graph.facebook.com/v18.0/241683569037594/messages";
  const accessToken =GRAPH_API_TOKEN;

  const config = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };

  const data = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: {
      body : message,
    },
  };
  addConversation(phoneNumber, message, ".", undefined);
  //console.log(conversationData);

  axios.post(url, data, config).then((response) => {
       console.log("Response:", response.data);
    
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
export default sendWhatsappMessage;

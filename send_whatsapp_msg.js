
import axios from "axios";
import {addConversation, conversationData} from "./server.js";
const WEBHOOK_VERIFY_TOKEN = "COOL";

const GRAPH_API_TOKEN="EAAVZBobCt7AcBO7a6TLkogECCQ86AfBGfVDfyajULnp7LvfSIIgWEKOMlgBXxHXf1SZC07ZBwqAt0DhAsh7Ro9HuZCfsZAChIvMZAz11Pech5fdZC38ZBjqTYSDMnRTXlCQK7iEsQOzQHLmCZAAsmZA2Fq9w8wISYQGgzFnENEN1uLaQ4ZAxMgxdJQlvpaWUbYZBD7FYMCWoVUKx8PEcZCJEvxgXXFu7kQpP9YZBO27iVjpNUeCbgdy6I1OjZAFq5yPjzKc";
const GPT_API_KEY = "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";

async function sendWhatsappMessage(phoneNumber, message) {
  const url = "https://graph.facebook.com/v18.0/376881142169572/messages";
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
 // addConversation(phoneNumber, message, ".", undefined);
  //console.log(conversationData);

  axios.post(url, data, config).then((response) => {
       console.log("Response:", response.data);
    
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
export default sendWhatsappMessage;

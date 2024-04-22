
import axios from "axios";
import {addConversation, conversationData} from "./server.js";
const WEBHOOK_VERIFY_TOKEN = "COOL";

const GRAPH_API_TOKEN = "EAAVZBobCt7AcBO63vGk4bL6OBfrZCNZC39XlB43ZCrSqZCKwUlt3WEpvlOEeS5vvsYrSaiD6Wi1ikVmGntaHQstF77vJZCDbyaByy5vl6ZCiluB9nmwGW3SvkaW5OM702jIqKRRLybWReJhpAV4sZA8l96EZCokVNXTgcZAYj0iMcu82X2VxNkm77up1YPkUPi6K0kBJsE5Xi5r7srXKloMiAZD";

const GPT_API_KEY = "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";

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
  console.log(conversationData);

  axios.post(url, data, config).then((response) => {
       console.log("Response:", response.data);
    
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
export default sendWhatsappMessage;
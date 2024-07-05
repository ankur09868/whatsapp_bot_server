
import axios from "axios";
import {addConversation, conversationData} from "./server.js";
const WEBHOOK_VERIFY_TOKEN = "COOL";

const GRAPH_API_TOKEN="EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P";
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
  //addConversation(phoneNumber, message, ".", "crm");
  //console.log(conversationData);

  axios.post(url, data, config).then((response) => {
       console.log("Response:", response.data);
    
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
export default sendWhatsappMessage;

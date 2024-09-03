import axios from "axios";
import { flow, adjList, currNode, AIMode, io, GRAPH_API_TOKEN, business_phone_number_id, contact } from "./server.js";
var curr_node = currNode;
export async function getFlow(phone_number) {
    const url = 'http://localhost:8000/get-flow/';
    // if (phone_number.startsWith("91")) {
    //   phone_number = phone_number.slice(2);
    // }
    try {
      const response = await axios.post(url, {
        phone_number: phone_number
      },
    {
      headers: {
        'X-Tenant-Id': "BMX"
      }
    });
  
      // Handle the response
      console.log('Response Data:', response.data);
      return response.data;
    } catch (error) {
      // Handle errors
      console.error('Error making POST request:', error.message);
      throw error;
    }
  }
  
  async function setFlow(phone_number, curr_node, ai_mode) {
    const url = 'http://localhost:8000/set-flow/';
    // if (phone_number.startsWith("91")) {
    //   phone_number = phone_number.slice(2);
    // }
    try {
      const response = await axios.post(url, {
        phone_number: phone_number,
        curr_node : curr_node,
        ai_mode : ai_mode,
      },
    {
      headers: {
        'X-Tenant-Id': "BMX"
      }
    });
  
      // Handle the response
      console.log('Response Data:', response.data);
      return response.data;
    } catch (error) {
      // Handle errors
      console.error('Error making POST request:', error.message);
      throw error;
    }
  }
  


async function sendImageMessage( message,business_phone_number_id, userSelection, zipName, prompt, imageUrl) {
    const result = await get_result_from_query(userSelection, zipName, prompt);
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.from,
        type: "image",
        image: {
          link: imageUrl,
          caption: `${userSelection} image - ${result}`
        }
      }
    });
  }
  
  async function sendButtonMessage(buttons, message){
    try {
      let button_rows = buttons.map(buttonNode => ({
        type: 'reply',
        reply: {
          id: flow[buttonNode].id,
          title: flow[buttonNode].body
        }
      }));
  
      const response = await axios.post(`https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message },
          action: { buttons: button_rows }
        }
      }, {
        headers: { Authorization: `Bearer ${GRAPH_API_TOKEN}` }
      });
  
      console.log('Button message sent successfully:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Failed to send button message:', error.response ? error.response.data : error.message);
      return { success: false, error: error.response ? error.response.data : error.message };
    }
  }
  
  async function sendListMessage(list, message){
    const rows = list.map((listNode, index) => ({
      id: flow[listNode].id,
      title: flow[listNode].body
    }));
  
    const actionSections = [{ title: "Section Title", rows }];
  
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data : {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "interactive",
        interactive: {
          type: "list",
          body: {
            text: message,
          },
          action: {
            button: "Choose Option",
            sections: actionSections,
          },
        },
      }
    })
  }
  
  async function sendInputMessage(message){
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "text",
        text: {
          body: message
        }
      }
    });
  }
  
  async function sendStringMessage(message){
    
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: contact.wa_id,
        type: "text",
        text: {
          body: message
        }
      }
    });
  }
  
  async function sendImagesMessage(message, url){
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`
      },
      data: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.from,
        type: "image",
        image: {
          link: url,
          caption: message
        }
      }
    });
  }
  
  async function sendAIMessage(message){
  
  }
  
  var nextNode;
  
export async function sendNodeMessage(node) {
    console.log("nodes rcvd: " ,node)
    if (typeof node !== 'undefined' && node !== null && adjList) {
      nextNode = adjList[node];
      const node_message = flow[node]?.body;
  
      if (node_message) {
        io.emit('node-message', {
          message: node_message,
          phone_number_id: business_phone_number_id
        });
        console.log("test");
      }
  
      console.log("messagee ", node_message);
  
      if (flow[node]?.type.toLowerCase() === "button") {
        const buttons = nextNode;
        await sendButtonMessage(buttons, node_message);
      } else if (flow[node]?.type === "List") {
        const list = nextNode;
        await sendListMessage(list, node_message);
      } else if (flow[node]?.type === "Input") {
        await sendStringMessage(node_message);
      } else if (flow[node]?.type === "string") {
        await sendStringMessage(node_message);
        curr_node = nextNode[0] || null;  // Ensure currNode is valid
        console.log("currrrrrrrrrrrr ", curr_node);
        if (curr_node !== null) {
          await sendNodeMessage(curr_node);
        }
      } else if (flow[node]?.type === "image") {
        await sendImagesMessage(node_message, flow[node]?.body?.url);
      } else if (flow[node]?.type === "AI") {
        await sendStringMessage(node_message);
        AIMode = true;
      }
  
      console.log("messagee2 ", node_message);
    } else {
      curr_node = 0;
      if(adjList) {nextNode = adjList[curr_node] || [];
      if (nextNode.length > 0) {
        sendNodeMessage(curr_node);
      } else {
        console.log("No further nodes to process.");
      }
    }
    }
    if (curr_node == null) curr_node = 8
    await setFlow(contact.wa_id, curr_node, AIMode)
  }
  
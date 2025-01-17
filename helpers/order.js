import axios from "axios";
import { djangoURL } from "../snm.js";
import { sendMessage } from "../send-message.js";
import  { sendProduct, sendBill} from "./product.js"

export const nuren_users = {
    'aayamhx': "917906511071"
}

export async function sendMessagetoConsumer(messageType, userSession, orderID, products = null) {
    let messageData;
    let message = "Your order has been taken. Your order ID is " + orderID;
    console.log("User Session: ", userSession)
    if(messageType === 'orderTaken') {
        messageData = {
            type: "text",
            text: { body: message }
        }
    }
    else if(messageType === 'orderConfirmed') {
        
        message = "Your order has been confirmed. Your order ID is: ORD#" + orderID;
        messageData = {
            type: "text",
            text: { body: message }
        }

        
        const productList = products.map(product => ({
            product_name: product.product_retailer_id,
            quantity: product.quantity
        }));
        sendBill()

    }
    else if(messageType === 'orderRejected') {
        message = "Unfortunately, your order has been rejected. Please contact customer support for further assistance.";
        messageData = {
            type: "text",
            text: { body: message }
        }
    }
    const userPhoneNumber = userSession.userPhoneNumber
    const business_phone_number_id = userSession.business_phone_number_id
    const access_token = userSession.accessToken
    const tenant_id = userSession.tenant
    return sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
}

export async function sendMessagetoRetailer(products, userSession, orderID) {
    let message = "📦 *New Order Received:*\n\n\n";
    message+=`📦 *Order ID:* ${orderID}\n\n`;
    let totalAmount = 0;

    products.forEach(product => {
        const { product_retailer_id, quantity, item_price, currency } = product;
        const productTotal = parseFloat(item_price) * parseInt(quantity);
        totalAmount += productTotal;
        message += `🔹 ${product_retailer_id} (${quantity}x) = ${item_price} ${currency} each\n\n`;
    });


    message += `\n\n\n💰 *Total Amount: ${totalAmount.toFixed(2)} USD*`;



    const userPhoneNumber = nuren_users[userSession.tenant]
    const business_phone_number_id = userSession.business_phone_number_id
    const access_token = userSession.accessToken
    const tenant_id = userSession.tenant
    const messageData = {
        type: "text",
        text: { body: message }
    }
    await sendMessage(userPhoneNumber, business_phone_number_id, messageData, access_token, tenant_id)
    const buttonMessageData = {
        type: "interactive",
        interactive: {
            type: "button",
            body: {
                text: "Would you like to accept or reject the order?"
            },
            action: {
                buttons: [
                    {
                        type: "reply",
                        reply: {
                            id: `confirm_${orderID}`,
                            title: "Accept"
                        }
                    },
                    {
                        type: "reply",
                        reply: {
                            id: `cancel_${orderID}`,
                            title: "Reject"
                        }
                    }
                ]
            }

        }
    }
    return sendMessage(userPhoneNumber, business_phone_number_id, buttonMessageData, access_token, tenant_id)
}

export async function orderToDB(mode, products=null, userSession, status, orderID) {
    const userPhoneNumber = userSession.userPhoneNumber
    const business_phone_number_id = userSession.business_phone_number_id
    const access_token = userSession.accessToken
    const tenant_id = userSession.tenant
    if(mode == "create"){
        const total_amount = products.reduce((total, product) => total + product.item_price * product.quantity, 0)
        console.log("Total Amount: ", total_amount)
        const response = await axios.post(`${djangoURL}/orders/create/`, {
            items: products,
            status: status,
            total: total_amount
        }, {
            headers: {'X-Tenant-Id': tenant_id}
        })
        console.log("Response: ", response.data)
        return response.data
    }
    else if(mode == "update"){
        const response = await axios.patch(`${djangoURL}/orders/update/${orderID}/`, {
            status: status
        }, {
            headers: {'X-Tenant-Id': tenant_id}
        })
        console.log("Response: ", response.data)
        return response.data
    }
}
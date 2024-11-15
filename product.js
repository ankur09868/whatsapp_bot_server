import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendProductMessage, sendListMessage, sendInputMessage, sendButtonMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage} from "./snm.js"
import { sendMessage  } from "./send-message.js";
import { validateInput, updateStatus, replacePlaceholders, addDynamicModelInstance, addContact, executeFallback } from "./misc.js"
import { getMediaID, handleMediaUploads, checkBlobExists, getImageAndUploadToBlob } from "./handle-media.js"
import { userSessions, io } from "./server.js";
import axios from "axios";

export async function sendProduct_List() {
    const messageData = {
      type: "interactive",
      interactive: 
      {
      type: "product_list",
      header:{
         type: "text",
          text: "TextHeaderContent"
       },
       body:{
          text: "TextBodyContent"
        },
       footer:{
          text:"TextFooterContent"
       },
       action:{
          catalog_id:"799995568791485",
          sections: [
               {
               title: "TheSectionTitle",             
               product_items: [
                    { product_retailer_id: "kzqkbik9gs" },
                    { product_retailer_id: "197td0owho" },
                ]},
                {
                title: "TheSectionTitle",
                product_items: [
                   { product_retailer_id: "nkx70axqlf" }
                ]},
            ]
        },
      }
    }

    const phone = 919557223443
    const bpid = 394345743768990
    const access_token = "EAAVZBobCt7AcBO02EyyYdLbpJn17HUXqAxQoZBxnhkGWTBrRiqBIZCOccY8peg73jQltdKc0vQF6u3EZA8wwaiGYTOF18ZAFQbLq5OsBCpPNReGCOvJS4MuQLiXt1t6WfkoJ5tnq65ITcygoKhh0eRU0GT9vWZBodvj3COpsYgG40R4XLZABHewbfm7FG6a2MbPy8YamxEDO4qoqZAKxrSpPZCJcL27dkdiGIBSobhILkJJpIPqYJkekIpmdI6V9ZB"

    await sendMessage(phone, bpid, messageData, access_token)
}

export async function sendProductList(userSession, message){
    const products = userSession.products
    console.log("PRODUCTSSSSSSS: ", products)
    const rows = products.map((product) => ({
        id: product.id,
        title: product.name
    }))
    console.log("ROWSSSSS: ", rows)
    const productListMessageData = {
        type: "interactive",
        interactive: {
            type: "list",
            body: {text: message},
            action: {
                button: "Choose Option",
                sections: [{ title: "Choose a Product", rows }]
            }
        }
    }
    await sendMessage(userSession.userPhoneNumber, userSession.business_number_id, productListMessageData, userSession.accessToken)
}

export async function sendBillMessage(){
    const messageData = {
        type: "interactive",
        interactive: {
            type: "order_details",
            body: {
                text: "This is Body"
            },
            action: {
                name: "review_and_pay",
                parameters: {
                    reference_id: "NurenAI",
                    type: "digital-goods",
                    currency: "INR",
                    total_amount: {
                        offset: 100,
                        value: 5000
                    },
                    payment_settings: [
                        {
                        type: "payment_gateway",
                        payment_gateway: {
                            type: "razorpay",
                            configuration_name: "nuren-config"
                        }
                    }
                ],
                    order: {
                        status: "pending",
                        catalog_id : 799995568791485,
                        items: [
                            {
                            retailer_id: "nkx70axqlf",
                            name: "Product 1",
                            amount: {
                                value: 202000,
                                offset: 100
                            },
                            quantity: 1
                        }
                    ],
                        subtotal: {
                            value: 202000,
                            offset: 100
                        },
                        tax: {
                            offset: 100,
                            value: 202000
                        }
                    }
                }
            }
        }
    }

    const phone = 919548265904
    const bpid = 394345743768990
    const access_token = "EAAVZBobCt7AcBO02EyyYdLbpJn17HUXqAxQoZBxnhkGWTBrRiqBIZCOccY8peg73jQltdKc0vQF6u3EZA8wwaiGYTOF18ZAFQbLq5OsBCpPNReGCOvJS4MuQLiXt1t6WfkoJ5tnq65ITcygoKhh0eRU0GT9vWZBodvj3COpsYgG40R4XLZABHewbfm7FG6a2MbPy8YamxEDO4qoqZAKxrSpPZCJcL27dkdiGIBSobhILkJJpIPqYJkekIpmdI6V9ZB"


    await sendMessage(phone, bpid, messageData, access_token)
}

export async function sendBill(totalAmount, product_list, userSession) {
console.log("PRODUCT LISTTTTTTTTTT: ", product_list)
const textMessageData = {
    type: "text",
    text: {
    body: `Thank you for shopping from our store!\n\nYour total order amount: ${totalAmount}\n\nItems you have purchased are:\n\n${product_list.map(item => `Product: *${item.product_name}*, Quantity: *${item.quantity}*`).join('\n\n')}\n\nPlease use the QR below to make the payment!`
    }
}
await sendMessage(userSession.userPhoneNumber, userSession.business_number_id, textMessageData, userSession.accessToken )
const QRMessageData = {
    type: "image",
    image: {
    id: 2017972652012373,
    caption: "Scan this QR Code with your payment provider app or just open the image in whatsapp."
    }
}
await sendMessage(userSession.userPhoneNumber, userSession.business_number_id, QRMessageData, userSession.accessToken)
}

export async function sendProduct(userSession, product_id) {
console.log("PRODUCTSIDIIDIID: ", product_id)
const productMessageData = {
    type: "interactive",
    interactive: {
    type: "product",
    body: {
        text: "Buy our product"
    },
    footer: {
        text: "Thanks"
    },
    action: {
        catalog_id: 799995568791485,
        product_retailer_id: product_id
    }
    }
}
await sendMessage(userSession.userPhoneNumber, userSession.business_number_id, productMessageData, userSession.accessToken )
console.log("take my whiskey neeeeeat")
userSession.currNode = 6
sendNodeMessage(userSession.userPhoneNumber, userSession.business_number_id)
}

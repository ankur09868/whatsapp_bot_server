import { sendProductMessage, chooseOptionMap } from "./snm.js"
import axios from "axios"
import { sendMessage } from "./send-message.js"

const DRISHTEE_PRODUCT_CAROUSEL_IDS = ["Personal Care", "Household Essentials", "Food and Beverages", "Electronics and Appliances", "Fashion and Apparel", "Health and Wellness",
    "Stationery and Office Supplies", "Animal and Agricultural Products", "Toys and Entertainment", "Miscellaneous"
]

const registry = {
    personal_care: {
        "Body Wash": 3,
        "Cosmetics": 6,
        "Hair Care": 11,
        "Oral Care": 15,
        "Shaving & Grooming": 19,
        "Eye Care": 9,
        "Mouth Fresener": 14,
        "Child Care": 4
    },
    household_essentials: {
        "Agarbatti": 1,
        "Dish Wash": 7,
        "Laundry": 12,
        "Lighting Equipment": 13,
        "Repellents": 18
    },
    food_and_beverages: {
        "Confectionaries": 5,
        "Foods": 10,
        "Spices": 20,
        "Tea": 22,
        "Beverages": 24,
        "Sweet": 45
    },
    electronics_and_appliances: {
        "Electronics": 8,
        "Home Appliances": 27,
        "Solar Products": 40,
        "Computer Peripheral": 30
    },
    fashion_and_apparel: {
        "Apparel - Ladies": 33,
        "Apparel - Gents": 34,
        "Apparel - Kids": 35,
        "Apparel - Accessories": 36,
        "Apparel - Home Furnishing": 37,
        "Textile": 42,
        "Garment": 43
    },
    health_and_wellness: {
        "OTC Medicine": 16,
        "Nutritional": 41,
        "Health & Hygiene": 26,
        "Bio-Fertilizer": 44
    },
    stationery_and_office_supplies: {
        "Stationary": 21,
        "Catalog Products": 25,
        "Recharge coupons": 17
    },
    animal_and_agricultural_products: {
        "Cattle Feed": 39,
        "Animal Health": 32,
        "Community Products": 38
    },
    toys_and_entertainment: {
        "Toys": 23
    },
    miscellaneous: {
        "Batteries": 2,
        "Fabric": 28,
        "Footwear": 29,
        "Commodity": 31
    }
};

      
    const DRISHTEE_PRODUCT_CATEGORY_IDS = {
      };
    
    //   const productList = [personal_care, household_essentials, food_and_beverages, electronics_and_appliances,
    //     fashion_and_apparel, health_and_wellness, stationery_and_office_supplies, animal_and_agricultural_products, 
    //     toys_and_entertainment, miscellaneous
    //   ]
    
export const DRISHTEE_IDS = [...DRISHTEE_PRODUCT_CAROUSEL_IDS, ...Object.keys(DRISHTEE_PRODUCT_CATEGORY_IDS)]

async function getKeyFromValue(registry, value) {

    console.log("rcvd regi: ", registry, "rcvd calue: ", typeof(value))
    for (const category in registry) {
        console.log("CATEGROFY: ", category)
        const subObject = registry[category];
        console.log("SUBOBJECTL: ", subObject)
        for (const key in subObject) {
            console.log("JEYEYEYE: ", key)
            const numericValue = Number(value);
            if (subObject[key] === numericValue) {
                console.log("Right Key: ", key)
                return key;
            }
        }
    }
    return null; // Return null if the value is not found
}

export async function handleCatalogManagement(selectionID, userSession) {
    const category_message = "Choose a Category:"
    console.log("Selection ID: ", selectionID)
    if(DRISHTEE_PRODUCT_CAROUSEL_IDS.includes(selectionID)){
        let messageData;
        const sanitized_id = selectionID.toLowerCase().replace(/ /g, '_')
        console.log("Category: ", sanitized_id)
        const category_list = Object.keys(registry[sanitized_id])
        if(category_list.length <= 3){
            let button_rows = category_list.map(category => ({
            type: 'reply',
            reply: {
                id: `drishtee_${registry[sanitized_id][category]}`,
                title: category
            }
            }));
            messageData = {
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: category_message },
                    action: { buttons: button_rows }
                }
            }
        }
        else{
            const rows = category_list.map((category) => ({
                id: `drishtee_${registry[sanitized_id][category]}`,
                title: category
            }))
            messageData = {
                type: "interactive",
                interactive: {
                    type: "list",
                    body: { text: category_message },
                    action: {
                        button: chooseOptionMap[`${userSession.language}`] || "Choose Option:",
                        sections: [{ title: "Title", rows }]
                    }
                }
            };
        }
        const fr_flag = false
        return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, fr_flag ,userSession.tenant);
    }
    else if(selectionID.split('_')[0] === 'drishtee'){
        const categoryID = selectionID.split('_')[1]
        const response = await axios.get(`https://testexpenses.drishtee.in/rrp/nuren/productlist?PhoneNumber=9643393874&CategoryCode=${categoryID}`)
        console.log("Response: ", response.data)
        const product_list = response.data.map(product => product.product_id)
        console.log("Product List: ", product_list)
        const fr_flag = false
        const header = await getKeyFromValue(registry, categoryID)
        const body = `Browse through our exclusive collection of ${header} products and find what suits your needs best. Shop now and enjoy amazing offers!`
        const catalog_id = 1134019438184024
        const footer = null
        const section_title = header
        const chunkSize = 30;
        for (let i = 0; i < product_list.length; i += chunkSize) {
            const chunk = product_list.slice(i, i + chunkSize);
            // Send the product message for the current chunk
            await sendProductMessage(userSession, chunk, catalog_id, header, body, footer, section_title, userSession.tenant, fr_flag);
        }
    }
    else{
        console.error("Given User Selection ID is not stored")
    }
}


import { sendProductMessage, chooseOptionMap, pickCategoryMap } from "./snm.js"
import axios from "axios"
import { sendMessage } from "./send-message.js"

const DRISHTEE_PRODUCT_CAROUSEL_IDS = ["Personal Care", "Household Essentials", "Food and Beverages", "Electronics and Appliances", "Fashion and Apparel", "Health and Wellness",
    "Stationery and Office Supplies", "Animal and Agricultural Products", "Toys and Entertainment", "Miscellaneous"
]

// const DRISHTEE_PRODUCT_CAROUSEL_IDS_HI = {
//     "पर्सनल केयर": "Personal Care",
//     "घरेलू सामान": "Household Essentials",
//     "खाद्य और पेय पदार्थ": "Food and Beverages",
//     "इलेक्ट्रॉनिक्स और उपकरण": "Electronics and Appliances",
//     "फैशन और परिधान": "Fashion and Apparel",
//     "स्वास्थ्य और कल्याण": "Health and Wellness",
//     "स्टेशनरी और कार्यालय सामग्री": "Stationery and Office Supplies",
//     "पशु और कृषि उत्पाद": "Animal and Agricultural Products",
//     "खिलौने और मनोरंजन": "Toys and Entertainment",
//     "विविध": "Miscellaneous"
// };

const DRISHTEE_PRODUCT_CAROUSEL_IDS_HI = [
    "पर्सनल केयर", "घरेलू सामान", "खाद्य और पेय पदार्थ", "इलेक्ट्रॉनिक्स और उपकरण", "फैशन और परिधान", "स्वास्थ्य और कल्याण", "स्टेशनरी और कार्यालय सामग्री", "पशु और कृषि उत्पाद", "खिलौने और मनोरंजन", "विविध"
]

const registry = {
    personal_care: {
        "Body Wash": 3,
        "Cosmetics": 6,
        "Hair Care": 11,
        "Oral Care": 15,
        "Shaving & Grooming": 19,
        "Eye Care": 9,
        "Mouth Freshener": 14,
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
        "Apparel-Ladies": 33,
        "Apparel-Gents": 34,
        "Apparel-Kids": 35,
        "Apparel-Accessories": 36,
        "Apparel-Home Furnishing": 37,
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

const registry_hi = {
    personal_care: {
        "बॉडी वॉश": 3,
        "सौंदर्य प्रसाधन": 6,
        "हेयर केयर": 11,
        "ऑरल केयर": 15,
        "शेविंग और ग्रूमिंग": 19,
        "आई केयर": 9,
        "मुँह ताज़ा करने वाला": 14,
        "बाल देखभाल": 4
    },
    household_essentials: {
        "अगरबत्ती": 1,
        "डिश वॉश": 7,
        "कपड़े धोने का सामान": 12,
        "प्रकाश उपकरण": 13,
        "कीट भगाने वाला": 18
    },
    food_and_beverages: {
        "मिठाई की दुकान का सामान": 5,
        "खाद्य पदार्थ": 10,
        "मसाले": 20,
        "चाय": 22,
        "पेय": 24,
        "मिठाई": 45
    },
    electronics_and_appliances: {
        "इलेक्ट्रॉनिक्स": 8,
        "घरेलू उपकरण": 27,
        "सौर उत्पाद": 40,
        "कंप्यूटर सहायक उपकरण": 30
    },
    fashion_and_apparel: {
        "महिला वस्त्र": 33,
        "पुरुष वस्त्र": 34,
        "बच्चों के कपड़े": 35,
        "सामान - वस्त्र": 36,
        "होम फर्निशिंग - वस्त्र": 37,
        "वस्त्र": 42,
        "परिधान": 43
    },
    health_and_wellness: {
        "ओटीसी दवाएं": 16,
        "पोषण संबंधी उत्पाद": 41,
        "स्वास्थ्य और स्वच्छता": 26,
        "जैव उर्वरक": 44
    },
    stationery_and_office_supplies: {
        "स्टेशनरी": 21,
        "कैटलॉग उत्पाद": 25,
        "रिचार्ज कूपन": 17
    },
    animal_and_agricultural_products: {
        "पशु चारा": 39,
        "पशु स्वास्थ्य": 32,
        "सामुदायिक उत्पाद": 38
    },
    toys_and_entertainment: {
        "खिलौने": 23
    },
    miscellaneous: {
        "बैटरियां": 2,
        "कपड़ा": 28,
        "जूते-चप्पल": 29,
        "वस्तु": 31
    }
};


const fallback_en = "Oops! It looks like this item is currently out of stock. Don't worry, we're working hard to restock it soon! In the meantime, feel free to browse similar products or check back later."
const fallback_hi = "क्षमा करें! यह उत्पाद वर्तमान में स्टॉक में उपलब्ध नहीं है। कृपया चिंता न करें, इसे शीघ्र ही स्टॉक में लाने के लिए हम प्रयासरत हैं। तब तक, आप समान उत्पाद ब्राउज़ कर सकते हैं या बाद में पुनः जांच सकते हैं।";

const DRISHTEE_PRODUCT_CATEGORY_IDS = {
};
    
    //   const productList = [personal_care, household_essentials, food_and_beverages, electronics_and_appliances,
    //     fashion_and_apparel, health_and_wellness, stationery_and_office_supplies, animal_and_agricultural_products, 
    //     toys_and_entertainment, miscellaneous
    //   ]
    
export const DRISHTEE_IDS = [...DRISHTEE_PRODUCT_CAROUSEL_IDS, ...DRISHTEE_PRODUCT_CAROUSEL_IDS_HI , ...Object.keys(DRISHTEE_PRODUCT_CATEGORY_IDS)]

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
    const category_message = pickCategoryMap[`${userSession.language}`]
    const language = userSession.language
    const local_reg = language == "en" ? registry : registry_hi
    console.log("Selection ID: ", selectionID)
    if(DRISHTEE_PRODUCT_CAROUSEL_IDS.includes(selectionID) || DRISHTEE_PRODUCT_CAROUSEL_IDS_HI.includes(selectionID)){
        let messageData;
        const index = language == "en" ? DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID) : DRISHTEE_PRODUCT_CAROUSEL_IDS_HI.indexOf(selectionID)
        const sanitized_id = DRISHTEE_PRODUCT_CAROUSEL_IDS[index].toLowerCase().replace(/ /g, '_')
        console.log("Category: ", sanitized_id)
        const category_list = Object.keys(local_reg[sanitized_id])
        console.log("Category List: ", category_list)
        if(category_list.length <= 3){
            let button_rows = category_list.map(category => ({
            type: 'reply',
            reply: {
                id: `drishtee_${local_reg[sanitized_id][category]}`,
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
                id:  `drishtee_${local_reg[sanitized_id][category]}`,
                title: category
            }))
            messageData = {
                type: "interactive",
                interactive: {
                    type: "list",
                    body: { text: category_message },
                    action: {
                        button: chooseOptionMap[`${userSession.language}`],
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
        if(product_list.length>0){const fr_flag = false
        const header = await getKeyFromValue(local_reg, categoryID)
        const body = userSession.language == "en" ? `Browse through our exclusive collection of ${header} products and find what suits your needs best. Shop now and enjoy amazing offers!` : `हमारे ${header} उत्पादों के विशेष संग्रह को ब्राउज़ करें और अपनी आवश्यकताओं के अनुसार सबसे उपयुक्त उत्पाद खोजें। अभी खरीदारी करें और शानदार ऑफ़र्स का आनंद लें!`
        const catalog_id = 1134019438184024
        const footer = null
        const section_title = header
        const chunkSize = 30;
        for (let i = 0; i < product_list.length; i += chunkSize) {
            const chunk = product_list.slice(i, i + chunkSize);
            // Send the product message for the current chunk
            await sendProductMessage(userSession, chunk, catalog_id, header, body, footer, section_title, userSession.tenant, fr_flag);
        }}
        else{
            const fallback_message = userSession.language == "en" ? fallback_en: fallback_hi
            const messageData = {
                type: "text",
                text: { body: fallback_message }
            }
            const fr_flag = false
            return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken, fr_flag ,userSession.tenant);
        }
    }
    else{
        console.error("Given User Selection ID is not stored")
    }
}


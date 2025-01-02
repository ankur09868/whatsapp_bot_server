import { sendProductMessage, chooseOptionMap, pickCategoryMap } from "./snm.js"
import axios from "axios"
import { sendMessage } from "./send-message.js"

export const DRISHTEE_PRODUCT_CAROUSEL_IDS = ["Personal Care", "Household Essentials", "Food and Beverages", "Electronics and Appliances", "Fashion and Apparel", "Health and Wellness","Stationery and Office Supplies", "Animal and Agricultural Products", "Toys and Entertainment", "Miscellaneous",
    "पर्सनल केयर", "घरेलू सामान", "खाद्य और पेय पदार्थ", "इलेक्ट्रॉनिक्स और उपकरण", "फैशन और परिधान", "स्वास्थ्य और कल्याण", "स्टेशनरी और कार्यालय सामग्री", "पशु और कृषि उत्पाद", "खिलौने और मनोरंजन", "विविध",
    "পার্সোনাল কেয়ার", "গৃহস্থালি সামগ্রী", "খাদ্য ও পানীয়", "ইলেকট্রনিক্স ও যন্ত্রপাতি", "ফ্যাশন ও পোশাক", "স্বাস্থ্য ও সুস্থতা", "স্টেশনারি ও অফিস সামগ্রী", "পশু ও কৃষি পণ্য", "খেলনা ও বিনোদন", "বিবিধ",
    "वैयक्तिक काळजी", "घरगुती गरजा", "अन्न आणि पेय", "इलेक्ट्रॉनिक्स आणि उपकरणे", "फॅशन आणि कपडे", "आरोग्य आणि निरोगी जीवन", "स्टेशनरी आणि कार्यालयीन साहि", "प्राणी आणि शेती उत्पादने", "खळणी आणि मनोरंजन", "इतर"
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


const registry_en = {
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

const registry_bn = {
    personal_care: {
        "বডি ওয়াশ": 3,
        "কসমেটিকস": 6,
        "হেয়ার কেয়ার": 11,
        "মাউথ কেয়ার": 15,
        "শেভিং ও গ্রুমিং": 19,
        "আই কেয়ার": 9,
        "মাউথ ফ্রেশনার": 14,
        "শিশু কেয়ার": 4
    },
    household_essentials: {
        "অগরবাতি": 1,
        "ডিশ ওয়াশ": 7,
        "লন্ড্রি": 12,
        "লাইটিং সরঞ্জাম": 13,
        "প্রতিরোধক": 18
    },
    food_and_beverages: {
        "কনফেকশনারি": 5,
        "খাদ্য": 10,
        "মশলা": 20,
        "চা": 22,
        "পানীয়": 24,
        "মিষ্টি": 45
    },
    electronics_and_appliances: {
        "ইলেকট্রনিকস": 8,
        "হোম অ্যাপ্লায়েন্স": 27,
        "সোলার প্রোডাক্টস": 40,
        "কম্পিউটার পারিফেরাল": 30
    },
    fashion_and_apparel: {
        "অ্যাপারেল-লেডিস": 33,
        "অ্যাপারেল-গেন্টস": 34,
        "অ্যাপারেল-কিডস": 35,
        "অ্যাপারেল-অ্যাক্সেসরিজ": 36,
        "অ্যাপারেল-হোম ফার্নিশিং": 37,
        "টেক্সটাইল": 42,
        "গার্মেন্ট": 43
    },
    health_and_wellness: {
        "ওটিসি মেডিসিন": 16,
        "পুষ্টিকর": 41,
        "স্বাস্থ্য ও হাইজিন": 26,
        "বায়ো-ফার্টিলাইজার": 44
    },
    stationery_and_office_supplies: {
        "স্টেশনারি": 21,
        "ক্যাটালগ পণ্য": 25,
        "রিচার্জ কুপন": 17
    },
    animal_and_agricultural_products: {
        "গবাদি পশুর খাবার": 39,
        "পশু স্বাস্থ্য": 32,
        "কমিউনিটি পণ্য": 38
    },
    toys_and_entertainment: {
        "খেলনা": 23
    },
    
    miscellaneous: {
        "ব্যাটারি": 2,
        "কাপড়": 28,
        "জুতো": 29,
        "কমোডিটি": 31
    }
};

const registry_mr = {
    personal_care: {
        "बॉडी वॉश": 3,
        "कोस्मेटिक्स": 6,
        "हेयर केअर": 11,
        "ओरल केअर": 15,
        "शेविंग & ग्रूमिंग": 19,
        "आय केअर": 9,
        "माउथ फ्रेशनर": 14,
        "चाइल्ड केअर": 4
    },
    household_essentials: {
        "अगरबत्ती": 1,
        "डिश वॉश": 7,
        "लॉन्ड्री": 12,
        "लाइटिंग उपकरण": 13,
        "प्रतिकारक": 18
    },
    food_and_beverages: {
        "कंफेक्शनरी": 5,
        "फूड्स": 10,
        "मसाले": 20,
        "चहा": 22,
        "पेय": 24,
        "स्विट": 45
    },
    electronics_and_appliances: {
        "इलेक्ट्रॉनिक्स": 8,
        "होम उपकरण": 27,
        "सोलार प्रोडक्ट्स": 40,
        "कॉम्प्युटर पेरिफेरल": 30
    },
    fashion_and_apparel: {
        "अॅपरेल-लेडीज": 33,
        "अॅपरेल-गेण्ट्स": 34,
        "अॅपरेल-किड्स": 35,
        "अॅपरेल-अॅक्सेसरीज़": 36,
        "अॅपरेल-होम फर्निशिंग": 37,
        "टेक्सटाइल": 42,
        "गारमेंट": 43
    },
    health_and_wellness: {
        "ओटीसी मेडिसिन": 16,
        "न्यूट्रिशनल": 41,
        "हेल्थ & हायजीन": 26,
        "बायो-फर्टिलायझर": 44
    },
    stationery_and_office_supplies: {
        "स्टेशनरी": 21,
        "कॅटलॉग उत्पादने": 25,
        "रिचार्ज कुपन": 17
    },
    animal_and_agricultural_products: {
        "गाईंचं खाद्य": 39,
        "प्राणी आरोग्य": 32,
        "समुदाय उत्पादने": 38
    },
    toys_and_entertainment: {
        "खेळणी": 23
    },
    
    miscellaneous: {
        "बॅटरी": 2,
        "कापड": 28,
        "चप्पल": 29,
        "कमोडिटी": 31
    }
};


const fallback_en = "Oops! It looks like this item is currently out of stock. Don't worry, we're working hard to restock it soon! In the meantime, feel free to browse similar products or check back later."
const fallback_hi = "क्षमा करें! यह उत्पाद वर्तमान में स्टॉक में उपलब्ध नहीं है। कृपया चिंता न करें, इसे शीघ्र ही स्टॉक में लाने के लिए हम प्रयासरत हैं। तब तक, आप समान उत्पाद ब्राउज़ कर सकते हैं या बाद में पुनः जांच सकते हैं।";
const fallback_bn = "ওহ! এটা বর্তমানে স্টক আউট রয়েছে। চিন্তা করবেন না, আমরা শীঘ্রই এটি পুনরায় স্টক করব! এর মধ্যে, আপনি অনুরূপ পণ্যগুলি দেখতে পারেন অথবা পরে আবার চেক করতে পারেন।"
const fallback_mr = "ओह! हे सध्या स्टॉकमध्ये नाही. काळजी करू नका, आम्ही लवकरच ते पुन्हा स्टॉक करू! तोपर्यंत, कृपया समान उत्पादने बघा किंवा नंतर पुन्हा तपासा."


    //   const productList = [personal_care, household_essentials, food_and_beverages, electronics_and_appliances,
    //     fashion_and_apparel, health_and_wellness, stationery_and_office_supplies, animal_and_agricultural_products, 
    //     toys_and_entertainment, miscellaneous
    //   ]
    
// export const DRISHTEE_IDS = [...DRISHTEE_PRODUCT_CAROUSEL_IDS, ...DRISHTEE_PRODUCT_CAROUSEL_IDS_HI, ...DRISHTEE_PRODUCT_CAROUSEL_IDS_BN, ...DRISHTEE_PRODUCT_CAROUSEL_IDS_MR]

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
    let local_reg, index, product_body, fallback_message;
    if(language == "en"){
        local_reg = registry_en
        index = DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID)
        product_body = `Browse through our exclusive collection of products and find what suits your needs best. Shop now and enjoy amazing offers!`
        fallback_message = fallback_en
    }
    else if(language == "bn"){
        local_reg = registry_bn
        index = DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID) % 10
        product_body = "আমাদের বিশেষ পণ্যের সংগ্রহ দেখুন এবং আপনার প্রয়োজন অনুযায়ী পছন্দ করুন। এখনই কেনাকাটা করুন এবং চমৎকার অফার উপভোগ করুন!"
        fallback_message = fallback_bn
    }
    else if(language == "hi"){
        local_reg = registry_hi
        index = DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID) % 10
        product_body = "हमारे उत्पादों के विशेष संग्रह को ब्राउज़ करें और अपनी आवश्यकताओं के अनुसार सबसे उपयुक्त उत्पाद खोजें। अभी खरीदारी करें और शानदार ऑफ़र्स का आनंद लें!"
        fallback_message = fallback_hi
    }
    else if(language == "mr"){
        local_reg = registry_mr
        index = DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID) % 10
        product_body = "आमच्या खास उत्पादनांच्या संग्रहातून ब्राउज करा आणि तुमच्या गरजेनुसार सर्वोत्तम निवडा. आत्ताच खरेदी करा आणि आश्चर्यकारक ऑफर्सचा आनंद घ्या!"
        fallback_message = fallback_mr
    }
    console.log("Selection ID: ", selectionID)
    if(DRISHTEE_PRODUCT_CAROUSEL_IDS.includes(selectionID)){
        let messageData;
        // const index = language == "en" ? DRISHTEE_PRODUCT_CAROUSEL_IDS.indexOf(selectionID) : DRISHTEE_PRODUCT_CAROUSEL_IDS_HI.indexOf(selectionID)
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
        return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken ,userSession.tenant);
    }
    else if(selectionID.split('_')[0] === 'drishtee'){
        const categoryID = selectionID.split('_')[1]
        const response = await axios.get(`https://testexpenses.drishtee.in/rrp/nuren/productlist?PhoneNumber=9643393874&CategoryCode=${categoryID}`)
        console.log("Response: ", response.data)
        userSession.api.POST['RRP_ID'] = response.data?.[0]?.RRP_ID
        userSession.api.POST['RRP_Name'] = response.data?.[0]?.RRP_Name
        const product_list = response.data.map(product => product.product_id)
        console.log("Product List: ", product_list)
        if(product_list.length>0){
            const header = await getKeyFromValue(local_reg, categoryID)
            // const body = userSession.language == "en" ? `Browse through our exclusive collection of ${header} products and find what suits your needs best. Shop now and enjoy amazing offers!` : `हमारे ${header} उत्पादों के विशेष संग्रह को ब्राउज़ करें और अपनी आवश्यकताओं के अनुसार सबसे उपयुक्त उत्पाद खोजें। अभी खरीदारी करें और शानदार ऑफ़र्स का आनंद लें!`
            const catalog_id = 1134019438184024
            const footer = null
            const section_title = header
            const chunkSize = 30;
            for (let i = 0; i < product_list.length; i += chunkSize) {
                const chunk = product_list.slice(i, i + chunkSize);
                await sendProductMessage(userSession, chunk, catalog_id, header, product_body, footer, section_title, userSession.tenant);
            }
        }
        else{
            // const fallback_message = userSession.language == "en" ? fallback_en: fallback_hi
            const messageData = {
                type: "text",
                text: { body: fallback_message }
            }
            return sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, messageData, userSession.accessToken ,userSession.tenant);
        }
    }
    else{
        console.error("Given User Selection ID is not stored")
    }
}


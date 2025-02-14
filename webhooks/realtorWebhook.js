import { convertImageToBase64 } from "../flowsAPI/flow.js";
import { sendMessage } from "../send-message.js";

let propertyDetails = {
    id: "property_919548265904",
    bhk: "3",
    price: "25000 per month",
    property_type: "Apartment",
    furnishing: "Semi Furnished",
    preferred_tenant: "Family",
    possession: "Immediate",
    parking: "2 Covered",
    age_of_building: "2 Years",
    balcony: "2",
    floor: "12",
    facing: "North-East",
    address: "123, Green Valley, Sector 62, Noida",
    other_amentities: [
        "24x7 Security",
        "Power Backup",
        "Swimming Pool",
        "Gym",
        "Club House"
    ],
    image: "iimage",
    description: "When you are looking to move into a popular society, Rajat Vihar is considered one of the best around Sector 62 in Noida. There is ample space for bike parking in this society, your vehicle will be fully protected and safe here. In line with the government mandate, and the best practises, there is a sewage treatment plant on the premises. Being sustainable as a society is very important, we have started by having a rainwater harvesting in the society. If you or the kids love playing tennis, this society is right for you as it has a tennis court here. From fire fighting equipment to general safety, this society has thought of it all. Nothing beats jumping into a pool on a hot summer day, here the swimming pool is a huge hit with all the residents. Working from home is convenient as this society has reliable electric back up. If you love playing badminton, don't miss out on the well maintained badminton court here.\n\nMore About This Property\n\nCheck out this Flat available for rent in Sector 62 A, Noida in Noida. It is a 2 BHK unit that comes at an affordable rent, with modern features and premium amenities to suit your lifestyle needs. The unit is semi furnished. It is an North-East facing property that has been constructed as per Vastu principles. With numerous new-age amenities and green surroundings, this Flat provides a convenient lifestyle for residents. A spacious house for your family, this unit includes 2 bedrooms. There are 2 bathroom and 2 balcony. It has a built-up area of 980 square_feet. The carpet area is 750 square_feet. The Flat is built on 0 floor. The building has a total of 3 floors. The monthly rent is Rs 30000 and the security deposit to be paid by residents is Rs 30000.\n\nProject Highlights\n\nThis Flat is constructed within Rajat Vihar. The developer also provides other units of 2 BHK configuration. Many amenities have been provided for the residents of this Flat. The locality Sector 62 A, Noida enjoys good connectivity to different parts of the city. The residents of this Flat will find many reputed healthcare centres in the neighborhood. There are hospitals like Aastha Healthcare, Metro Multispeciality Hospital: Best Hospital in Noida, Uttar Pradesh | Top Ranking Hospital in 2024, SANKHWAR HOSPITAL"
};

let imageData = {}

export async function realtorWebhook( userSession) {

    
    imageData = {
        Balcony: ["balcony1.jpg", "balcony2.jpg"],
        Bedroom: ["bedroom1.jpg", "bedroom2.jpg"],
        Hall: ["hall1.jpg", "hall2.jpg", "hall3.jpg"],
        Kitchen: ["kitchen1.jpg", "kitchen2.jpg"],
        Locality: ["locality1.jpg", "locality2.jpg", "locality3.jpg"]
    }
    const about = await generatePropertyRichText(propertyDetails)
    console.log("About: ", about)
    const payload = {
        screen: "WELCOME",
        data: {
            id: propertyDetails.id,
            coverImage: await convertImageToBase64("./images/coverimage.jpg"),
            price: propertyDetails.price,
            furnishing: propertyDetails.furnishing,
            type: `${propertyDetails.bhk} BHK ${propertyDetails.property_type}`,
            tenants: propertyDetails.preferred_tenant,
            description: propertyDetails.description,
            nurenAILogo: await convertImageToBase64("./webhooks/nurenai image.jpg"),
            about: about,
        }
    };
    
    const messageData = {
        type: "interactive",
        interactive: {
            type: "flow",
            body: { text: "3 BHK Flat for Rent" },
            action: {
                name: "flow",
                parameters: {
                    flow_message_version: "3",
                    flow_token: "COOL",
                    flow_name: "realtor",
                    flow_cta: "View Property",
                    flow_action: "navigate",
                    flow_action_payload: payload
                }
            }
        }
    };
    await sendMessage(
        userSession.userPhoneNumber,
        userSession.business_phone_number_id,
        messageData,
        userSession.accessToken,
        userSession.tenant
    );
}


export const getNextScreen = async (decryptedBody) => {
    const { screen, data, version, action, flow_token } = decryptedBody;
  
    // Handle health check request
    if (action === "ping") {
      return {
        data: {
          status: "active",
        },
      };
    }
  
    if(action === "INIT"){
      return {
        screen: "WELCOME",
        data: {
            id: propertyDetails.id,
            coverImage: await convertImageToBase64("./images/coverimage.jpg"),
            price: propertyDetails.price,
            furnishing: propertyDetails.furnishing,
            type: `${propertyDetails.bhk} BHK ${propertyDetails.property_type}`,
            tenants: propertyDetails.preferred_tenant,
            description: propertyDetails.description,
            nurenAILogo: await convertImageToBase64("./webhooks/nurenai image.jpg"),
            about: await generatePropertyRichText(propertyDetails),
        }
      }
    }
  
    if (data?.error) {
      console.warn("Received client error:", data);
      return {
        data: {
          acknowledged: true,
        },
      };
    }

    if(action === "data_exchange"){
        let list, n, payload;
        switch(screen){
            case "OVERVIEW":
                list = imageData.Balcony
                n = list.length

                payload = {
                    screen: "BALCONY",
                    data: {
                        numberOfBalconyImages: n
                    }
                }

                for(let i=0; i<n; i++){
                    const image = await convertImageToBase64(`./images/${list[i]}`)
                    payload["data"][`balcony${i+1}`] = image
                }

                return payload

            case "BALCONY":
                list = imageData.Bedroom
                n = list.length

                payload = {
                    screen: "BEDROOM",
                    data: {
                        numberOfBedroomImages: n
                    }
                }

                for(let i=0; i<n; i++){
                    const image = await convertImageToBase64(`./images/${list[i]}`)
                    payload["data"][`bedroom${i+1}`] = image
                }

                return payload
            
            case "BEDROOM":
                list = imageData.Kitchen
                n = list.length

                payload = {
                    screen: "KITCHEN",
                    data: {
                        numberOfKitchenImages: n
                    }
                }

                for(let i=0; i<n; i++){
                    const image = await convertImageToBase64(`./images/${list[i]}`)
                    payload["data"][`kitchen${i+1}`] = image
                }

                return payload
                
            case "KITCHEN":
                list = imageData.Hall
                n = list.length

                payload = {
                    screen: "HALL",
                    data: {
                        numberOfHallImages: n
                    }
                }

                for(let i=0; i<n; i++){
                    const image = await convertImageToBase64(`./images/${list[i]}`)
                    payload["data"][`hall${i+1}`] = image
                }
                return payload

            case "HALL":
                list = imageData.Locality
                n = list.length

                payload = {
                    screen: "LOCALITY",
                    data: {
                        numberOfLocalityImages: n
                    }
                }

                for(let i=0; i<n; i++){
                    const image = await convertImageToBase64(`./images/${list[i]}`)
                    payload["data"][`locality${i+1}`] = image
                }
                return payload
        }
    }
  
    // if (action === "data_exchange") {
    //   switch (screen) {
    //     case "LOGIN":
    //       signinMF(data.pan, data.password)
  
    //       // const portfolioi = [
    //       //   {
    //       //     companyName: "Apple Inc.",
    //       //     holdingPercentage: "25%",
    //       //     investedValue: "$25,000",
    //       //     marketValue: "$30,000",
    //       //     gainLoss: "+$5,000"
    //       //   },
    //       //   {
    //       //     companyName: "Tesla Inc.",
    //       //     holdingPercentage: "15%",
    //       //     investedValue: "$15,000",
    //       //     marketValue: "$20,000",
    //       //     gainLoss: "+$5,000"
    //       //   },
    //       //   {
    //       //     companyName: "Amazon Inc.",
    //       //     holdingPercentage: "10%",
    //       //     investedValue: "$10,000",
    //       //     marketValue: "$8,500",
    //       //     gainLoss: "-$1,500"
    //       //   },
    //       //   {
    //       //     companyName: "Google Inc.",
    //       //     holdingPercentage: "30%",
    //       //     investedValue: "$50,000",
    //       //     marketValue: "$60,000",
    //       //     gainLoss: "+$10,000"
    //       //   },
    //       //   {
    //       //     companyName: "Microsoft Corp.",
    //       //     holdingPercentage: "20%",
    //       //     investedValue: "$40,000",
    //       //     marketValue: "$45,000",
    //       //     gainLoss: "+$5,000"
    //       //   }
    //       // ];
  
  
    //       return {
    //         screen: "SIGNINWAIT",
    //         data: {
    //           heading: "Hang Tight!",
    //           text: "The login process may take 1-2 minutes. \nClick 'Check Status' below to check your login status. ",
    //           footer: "Wait Time: 60s."
    //         }
    //       }
  
    //     case "SIGNINWAIT":
    //       console.log(signInQuestion)
    //       if (signInQuestion) {
    //         console.log("Login is success");
    //         const questionToReturn = signInQuestion
    //         signInQuestion = null
    //         return {
    //           screen: "SECURITYQUESTION",
    //           data: {
    //             question: questionToReturn
    //           }
    //         };
    //       }
    //       else {
    //         console.log("Still waiting for process to complete...");
    //         return {
    //           screen: "SIGNINWAIT",
    //           data: {
    //             heading: "Hang Tight!",
    //             text: "This process may take 1-2 minutes. \nClick 'Check Status' below to check your status. ",
    //             footer: "Wait Time: 30s"
    //           }
    //         };
    //       }
    
    //     case "SIGNUP":
    //       signupMF(data.pan, data.phone)
          
    //       return {
    //         screen: "SIGNUPWAIT",
    //         data: {
    //           heading: "Creating your account...",
    //           text: "This may take up to few mins",
    //           footer: "Wait Time: 1m 19s"
    //         }
    //       };
  
    //     case "SIGNUPWAIT":
    //       if(signupFlag){
    //         return {
    //           screen: "VERIFYOTP",
    //           payload: {}
    //         }
    //       }else{
    //         return {
    //           screen: "SIGNUPWAIT",
    //           data: {
    //             heading: "Creating your account...",
    //             text: "This may take up to few mins",
    //             footer: "Wait Time: 34s"
    //           }
    //         }
    //       }
    
    //     // case "FORGOT_PASSWORD":
    //       // flowStateStore.set(data.phone, {
    //       //   flow_type: 'forgot_password'
    //       // });
          
    //       // const forgotOtp = await sendOtp(data.phone);
    //       // otpStore.set(data.phone, forgotOtp);
          
    //       // return {
    //       //   screen: "VERIFYOTP",
    //       //   data: {
    //       //     otp: forgotOtp,
    //       //     phone: data.phone,
    //       //     otp_error: false,
    //       //     flow_type: "forgot_password"
    //       //   }
    //       // };
    
    //     case "VERIFYOTP":
    //       const otpVerified = await verifyOTPMF(data.otp)
    //       if (otpVerified) {
    //           return {
    //             screen: "REGISTER",
    //             data: {}
    //           };
    //       } else {
    //         return {
    //           screen: "VERIFYOTP",
    //           data: {},
    //         };
    //       }
  
    //     case "REGISTER":
    //       await setPasswordMF(data.name, data.password, data.password)
    //       return {
    //         screen: "SECURITY",
    //         data: {}
    //       };
  
    //     case "SECURITY":
    //       console.log("Security Data Received: ", data)
    
    //       return {
    //         screen: "LUFFY",
    //         data: {
    //           heading: "Congrats!",
    //           text: "You have been successfully registered with our organization."
    //         }
    //       };
  
    //     // case "CHANGE_PASSWORD":
    //       // if (data.new_password !== data.confirm_password) {
    //       //   return {
    //       //     screen: "CHANGE_PASSWORD",
    //       //     data: {
    //       //       error: true,
    //       //       message: "Passwords do not match"
    //       //     }
    //       //   };
    //       // }
    //       // updatePassword(data.phone, data.new_password)
    //       // // await updatePassword(flowStateStore.get(data.phone)?.phone, data.new_password);
    //       // flowStateStore.delete(data.phone);
          
    //       // return {
    //       //   screen: "LOGIN",
    //       //   data: {}
    //       // };
    //     case "SECURITYQUESTION":
    //       submitMF(data.answer)
  
    //       return {
    //         screen: "SUBMITWAIT",
    //         data: {
    //           heading: "Please Wait",
    //           text: "Gathering your assets and holdings..",
    //           footer: "Wait Time: 15s"
    //         }
    //       }
          
    //     case "SUBMITWAIT":
    //       console.log(portfolio)
  
    //       if (portfolio) {
    //         const portfolioTable = await generateMarkdownTable(portfolio)
  
    //         return {
    //           screen: "PORTFOLIO",
    //           data: {
    //             array: portfolioTable
    //           }
    //         };
    //       } else {
    //         return {
    //           screen: "SUBMITWAIT",
    //           data: {
    //             heading: "Please Wait",
    //             text: "Gathering your assets and holdings..",
    //             footer: "Wait Time: 10s"
    //           }
    //         };
    //       }
  
    //     default:
    //       break;
  
    //   }
    // }


  
  
    console.error("Unhandled request body:", decryptedBody);
    throw new Error(
      "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
    );
  };

  async function generatePropertyRichText(propertyDetails) {
    const output = [];
    
    if (propertyDetails.image) {
        const image = await convertImageToBase64("./images/coverimage.jpg")
        output.push(`![Property Image](data:image/png;base64,${image})`);
    }
  
    // Section builder with conditional headings
    const buildSection = (title, items) => {
      if (items.length === 0) return;
      output.push(`**${title.toUpperCase()}**`);
      output.push(...items);
      output.push('╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌');
    };
  
    // Core Information
    const coreInfo = [];
    if (propertyDetails.bhk) coreInfo.push(`🛏️ *${propertyDetails.bhk} BHK*`);
    if (propertyDetails.property_type) coreInfo.push(`🏠 *Type:* ${propertyDetails.property_type}`);
    if (propertyDetails.preferred_tenant) coreInfo.push(`👤 *Tenant Preference:* ${propertyDetails.preferred_tenant}`);
    if (propertyDetails.possession) coreInfo.push(`📅 *Possession:* ${propertyDetails.possession}`);
    buildSection('Property Overview', coreInfo);
  
    // Structural Details
    const structure = [];
    if (propertyDetails.floor) structure.push(`↕️ *Floor:* ${propertyDetails.floor}`);
    if (propertyDetails.facing) structure.push(`🧭 *Facing:* ${propertyDetails.facing}`);
    if (propertyDetails.balcony) structure.push(`🌇 *Balconies:* ${propertyDetails.balcony}`);
    if (propertyDetails.parking) structure.push(`🚗 *Parking:* ${propertyDetails.parking}`);
    if (propertyDetails.age_of_building) {
      const age = isNaN(propertyDetails.age_of_building) 
        ? propertyDetails.age_of_building 
        : `${propertyDetails.age_of_building} years`;
      structure.push(`🏗️ *Building Age:* ${age}`);
    }
    buildSection('Building Specifications', structure);
  
    // Location & Amenities
    const location = [];
    if (propertyDetails.address) {
      location.push(`📍 **Address:**\n${propertyDetails.address.replace(/,/g, ',\n')}`);
    }
    if (propertyDetails.other_amentities) {
      const amenities = Array.isArray(propertyDetails.other_amentities)
        ? propertyDetails.other_amentities.join('\n• ')
        : propertyDetails.other_amentities;
      location.push(`\n✅ **Key Amenities:**\n• ${amenities}`);
    }
    buildSection('Location Features', location);
  
    if (output.length > 0) {
      output.pop();
    //   output.push('\nℹ️ Visit [website](https://www.nobroker.in/?utm_source=google&utm_medium=cpc&utm_campaign=Pmax_LP_AllCities_OwnerLeads&gad_source=1&gclid=CjwKCAiAzba9BhBhEiwA7glbakAV2AnmNpY--dk9JnJL2yIubblq8YDNwfvt4Od4iXTPJQLCQHlBVxoCA1kQAvD_BwE) for more details');
    }
  
    return output.length > 0 ? output : ['*No property details available*'];
}

export async function sendWelcomeMessageforRealtor(userSession, owner){
    const waitingMessageForConsumer = "Hang tight! We're connecting you with the owner. It won’t take long. ⏳"  
    sendMessage(userSession.userPhoneNumber, userSession.business_phone_number_id, {type: "text", text: {body: waitingMessageForConsumer}}, userSession.accessToken, userSession.tenant)
  
    const welcomeMessageForRetailer = `${userSession.userName} wants to chat with you regarding one of your properties! Press the button to start the conversation. 🚀`  
    const buttonMessageBody = {        
      type: "interactive", 
      interactive: {
        type: "button", 
        body: { text: welcomeMessageForRetailer }, 
        action: { buttons: [{type: "reply", reply: {id: `buyer_${userSession.userPhoneNumber}`, title: "Start Talking"}}]}}
    }
    sendMessage(owner, userSession.business_phone_number_id, buttonMessageBody, userSession.accessToken, userSession.tenant)
  }
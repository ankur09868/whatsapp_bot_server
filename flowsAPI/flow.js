import axios from "axios";
import { sendMessage } from "../send-message.js";
// const url = "https://x01xx96q-8000.inc1.devtunnels.ms"
// const url = "http://localhost:3000"

const url = "https://mfcentral-hfckakhnbqe0h6gp.canadacentral-01.azurewebsites.net"


let signInQuestion = null;
let portfolio = null;
let signupFlag = null;

async function generateMarkdownTable(portfolio) {
  // Define the header and divider for the table
  const header = "| Company Name | Holding Percentage | Invested Value | Market Value | Gain/Loss |";
  const divider = "|-------------------|-------------------------|---------------------|------------------|---------------|";

  let totalInvestedValue = 0;
  let totalMarketValue = 0;
  let totalGainLoss = 0;

  const rows = portfolio.map((entry) => {
    // Convert values to numbers for calculation (strip $ and commas)
    const investedValue = parseFloat(entry.investedValue.replace(/[^0-9.-]+/g, ""));
    const marketValue = parseFloat(entry.marketValue.replace(/[^0-9.-]+/g, ""));
    const gainLoss = parseFloat(entry.gainLoss.replace(/[^0-9.-]+/g, ""));

    // Update totals
    totalInvestedValue += investedValue;
    totalMarketValue += marketValue;
    totalGainLoss += gainLoss;

    // Return table row string
    return `| ${entry.companyName.padEnd(17)} | ${entry.holdingPercentage.padEnd(24)} | ${entry.investedValue.padEnd(21)} | ${entry.marketValue.padEnd(16)} | ${entry.gainLoss.padEnd(15)} |`;
  });

  const summary = [
    `+ **Total Invested Value** : $${totalInvestedValue.toLocaleString()} `,
    `+ **Total Market Value** : $${totalMarketValue.toLocaleString()} `,
    `+ **Total Gain/Loss** : $${totalGainLoss.toLocaleString()} `
  ];


  
  return [header, divider, ...rows, ...summary]
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
        image: await convertImageToBase64("flowsAPI/login-form-2.png")
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

  if (action === "data_exchange") {
    switch (screen) {
      case "LOGIN":
        signinMF(data.pan, data.password)

        // const portfolioi = [
        //   {
        //     companyName: "Apple Inc.",
        //     holdingPercentage: "25%",
        //     investedValue: "$25,000",
        //     marketValue: "$30,000",
        //     gainLoss: "+$5,000"
        //   },
        //   {
        //     companyName: "Tesla Inc.",
        //     holdingPercentage: "15%",
        //     investedValue: "$15,000",
        //     marketValue: "$20,000",
        //     gainLoss: "+$5,000"
        //   },
        //   {
        //     companyName: "Amazon Inc.",
        //     holdingPercentage: "10%",
        //     investedValue: "$10,000",
        //     marketValue: "$8,500",
        //     gainLoss: "-$1,500"
        //   },
        //   {
        //     companyName: "Google Inc.",
        //     holdingPercentage: "30%",
        //     investedValue: "$50,000",
        //     marketValue: "$60,000",
        //     gainLoss: "+$10,000"
        //   },
        //   {
        //     companyName: "Microsoft Corp.",
        //     holdingPercentage: "20%",
        //     investedValue: "$40,000",
        //     marketValue: "$45,000",
        //     gainLoss: "+$5,000"
        //   }
        // ];


        return {
          screen: "SIGNINWAIT",
          data: {
            heading: "Hang Tight!",
            text: "The login process may take 1-2 minutes. \nClick 'Check Status' below to check your login status. ",
            footer: "Wait Time: 60s."
          }
        }

      case "SIGNINWAIT":
        console.log(signInQuestion)
        if (signInQuestion) {
          console.log("Login is success");
          const questionToReturn = signInQuestion
          signInQuestion = null
          return {
            screen: "SECURITYQUESTION",
            data: {
              question: questionToReturn
            }
          };
        }
        else {
          console.log("Still waiting for process to complete...");
          return {
            screen: "SIGNINWAIT",
            data: {
              heading: "Hang Tight!",
              text: "This process may take 1-2 minutes. \nClick 'Check Status' below to check your status. ",
              footer: "Wait Time: 30s"
            }
          };
        }
  
      case "SIGNUP":
        signupMF(data.pan, data.phone)
        
        return {
          screen: "SIGNUPWAIT",
          data: {
            heading: "Creating your account...",
            text: "This may take up to few mins",
            footer: "Wait Time: 1m 19s"
          }
        };

      case "SIGNUPWAIT":
        if(signupFlag){
          return {
            screen: "VERIFYOTP",
            payload: {}
          }
        }else{
          return {
            screen: "SIGNUPWAIT",
            data: {
              heading: "Creating your account...",
              text: "This may take up to few mins",
              footer: "Wait Time: 34s"
            }
          }
        }
  
      // case "FORGOT_PASSWORD":
        // flowStateStore.set(data.phone, {
        //   flow_type: 'forgot_password'
        // });
        
        // const forgotOtp = await sendOtp(data.phone);
        // otpStore.set(data.phone, forgotOtp);
        
        // return {
        //   screen: "VERIFYOTP",
        //   data: {
        //     otp: forgotOtp,
        //     phone: data.phone,
        //     otp_error: false,
        //     flow_type: "forgot_password"
        //   }
        // };
  
      case "VERIFYOTP":
        const otpVerified = await verifyOTPMF(data.otp)
        if (otpVerified) {
            return {
              screen: "REGISTER",
              data: {}
            };
        } else {
          return {
            screen: "VERIFYOTP",
            data: {},
          };
        }

      case "REGISTER":
        await setPasswordMF(data.name, data.password, data.password)
        return {
          screen: "SECURITY",
          data: {}
        };

      case "SECURITY":
        console.log("Security Data Received: ", data)
  
        return {
          screen: "LUFFY",
          data: {
            heading: "Congrats!",
            text: "You have been successfully registered with our organization."
          }
        };

      // case "CHANGE_PASSWORD":
        // if (data.new_password !== data.confirm_password) {
        //   return {
        //     screen: "CHANGE_PASSWORD",
        //     data: {
        //       error: true,
        //       message: "Passwords do not match"
        //     }
        //   };
        // }
        // updatePassword(data.phone, data.new_password)
        // // await updatePassword(flowStateStore.get(data.phone)?.phone, data.new_password);
        // flowStateStore.delete(data.phone);
        
        // return {
        //   screen: "LOGIN",
        //   data: {}
        // };
      case "SECURITYQUESTION":
        submitMF(data.answer)

        return {
          screen: "SUBMITWAIT",
          data: {
            heading: "Please Wait",
            text: "Gathering your assets and holdings..",
            footer: "Wait Time: 15s"
          }
        }
        
      case "SUBMITWAIT":
        console.log(portfolio)

        if (portfolio) {
          const portfolioTable = await generateMarkdownTable(portfolio)

          return {
            screen: "PORTFOLIO",
            data: {
              array: portfolioTable
            }
          };
        } else {
          return {
            screen: "SUBMITWAIT",
            data: {
              heading: "Please Wait",
              text: "Gathering your assets and holdings..",
              footer: "Wait Time: 10s"
            }
          };
        }

      default:
        break;

    }
  }


  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};

async function sendOtp(phone) {
  const otp = Math.floor(100000 + Math.random() * 900000);
  const bpid = 534896646366826;
  const access_token = "EAAVZBobCt7AcBO1IxLG4luufAySUGczTQZAeGZBZBDsGRLQZAaLJSVVCfTDJ1Eq23V7WhS6PVYZBCr9AHatrUyyFLuUDMXMLm2q2Oed2F9LAfsozZAVDvUvmBJNgGH8YVjpbOFTHVJjvZAQ2RY6aliQqpAP3XvrhxLm2tFJx8eobUxpX8njE1V2BmWhxwMmqfwfdjTqWJlFfdzR7qqkAZCv6HmQqYZASW1xkplAePvGYdJinL0Ibh5FvSFYfxkUyqR";
  
  const messageData = {
    type: "text",
    text: { body: `Your One-Time-Password is: ${otp}` }
  };
  
  await sendMessage(phone, bpid, messageData, access_token, "leqcjsk");
  return otp;
}

async function saveDetails(data) {
  console.log("Saving Details: ", JSON.stringify(data, null, 3));
}

async function verifyLogin(pan, password) {
  const response = await axios.get(`http://localhost:8000/temp-flow-data/${pan}`)
  const userDetails = response.data
  console.log(userDetails.password)
  console.log(password)
  if(userDetails.password == password) return { success: true };
  else return { success : false };
}

async function addUser(PAN) {
  const response = await axios.post(`http://localhost:8000/temp-flow-data`, {"PAN": PAN})
}

async function updateUser(PAN, data) {
  console.log("Data to be u[dted: ", data)
  const response = await axios.patch(`http://localhost:8000/temp-flow-data/${PAN}`, data)

}

async function updatePassword(phone, newPassword) {
  const response = await axios.get(`http://localhost:8000/get-flow-data`)
  const pan = response.find(record => record.phone === phone)?.PAN || null;
  axios.patch(`http://localhost:8000/temp-flow-data/${pan}`, {"password": newPassword})
}

import { promises as fs } from "fs"; // Import fs.promises module
import { postRegister } from "../helpers/login-flow.js";

export const convertImageToBase64 = async (filePath) => {
  try {
    const data = await fs.readFile(filePath); // Read the file asynchronously
    const base64 = data.toString("base64"); // Convert the binary data to Base64
    // console.log("Base64:", base64);
    return base64;
  } catch (err) {
    console.error("Error reading file:", err);
    throw err; // Handle or rethrow the error
  }
};

async function signupMF(pan, mobile) {
  const response = await axios.post(`${url}/signup`, {pan, mobile})
  signupFlag = response.data.success
}

async function verifyOTPMF(otp) {
  const response = await axios.post(`${url}/verify-otp`, otp)
  console.log("Response rcvd in verify OTP: ", response.data)
  return response.data.success
}

async function setPasswordMF(displayName, password, confirmPassword) {
  const response = await axios.post(`${url}/set-password`, {displayName, password, confirmPassword})
  console.log("Response rcvd in set password: ", response.data)
}

async function securityQuestionsMF(data) {
  const response = await axios.post(`'${url}/security-questions`, data)
  console.log("Response rcvd in security questions: ", response.data)
}

async function signinMF(pan, password) {
  try {
    const data = { pan: pan, password: password }; 
    const response = await fetch(`${url}/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("Response received in sign-in: ", responseData);

    if (responseData.success === true) {
      signInQuestion = responseData.question;
    } else {
      console.error("Sign-in failed or response format invalid:", responseData);
    }
  } catch (err) {
    console.error("Error in sign-in function: ", err);
  }
}


async function submitMF(userAnswer) {
  try{
    const data = {"userAnswer": userAnswer}
    console.log("Sending data to submit: ", data)
    const response = await axios.post(`${url}/submit`, data, {timeout: 300000})
    console.log("Response rcvd in submit: ", response.data)
    if(response.data.success){
      portfolio = response.data.portfolio
    }
    else if(!response.data.success) return response.data.success
  }catch (err){
    console.log("Error in submittiititmf: ", err)
  }

}


// if (action === "data_exchange") {
//   switch (screen) {

//     case "LOGIN":
//       pan_no = data.pan
//       const loginResult = await verifyLogin(pan_no, data.password);
//       if (loginResult.success) {
//         console.log("Login is success")
//         const response = await axios.get(`http://localhost:8000/temp-flow-data/${pan_no}`)

//         const questionData = response.data.questions[Math.floor(Math.random() * response.data.questions.length)];

//         return {
//           screen: "SECURITYQUESTION",
//           data: {
//             question: questionData.question,
//             pan: pan_no
//           }
//         };
//       } else {
//         return {
//           screen: "LOGIN",
//           data: {
//             error: true,
//             message: "Invalid credentials"
//           }
//         };
//       }

//     case "SIGNUP":
//       // Store PAN for later use
//       flowStateStore.set(data.phone, {
//         pan: data.pan,
//         flow_type: 'signup'
//       });
//       addUser(data.pan)
//       const otp = await sendOtp(data.phone);
//       otpStore.set(data.phone, otp);
      
//       return {
//         screen: "VERIFYOTP",
//         data: {
//           otp: otp,
//           phone: data.phone,
//           otp_error: false,
//           flow_type: "signup"
//         }
//       };

//     case "FORGOT_PASSWORD":
//       flowStateStore.set(data.phone, {
//         flow_type: 'forgot_password'
//       });
      
//       const forgotOtp = await sendOtp(data.phone);
//       otpStore.set(data.phone, forgotOtp);
      
//       return {
//         screen: "VERIFYOTP",
//         data: {
//           otp: forgotOtp,
//           phone: data.phone,
//           otp_error: false,
//           flow_type: "forgot_password"
//         }
//       };

//     case "VERIFYOTP":
//       const ver_phone = data.phone;
//       const ver_otp = data.otp;
//       const stored_otp = data.otp_data; // Using the otp_data from payload
//       const flowState = flowStateStore.get(ver_phone);
//       if (stored_otp == ver_otp) {
//         // Clear OTP after successful verification
//         otpStore.delete(ver_phone);
        
//         // Route based on stored flow type
//         if (flowState?.flow_type === "forgot_password") {
//           return {
//             screen: "CHANGE_PASSWORD",
//             data: {
//               phone: ver_phone
//             }
//           };
//         } else {
//           console.log("PAN: ", flowState?.pan)
//           updateUser(flowState?.pan, {"phone": ver_phone})
//           return {
//             screen: "REGISTER",
//             data: {
//               pan: flowState?.pan
//             }
//           };
//         }
//       } else {
//         return {
//           screen: "VERIFYOTP",
//           data: {
//             otp: stored_otp,
//             phone: ver_phone,
//             otp_error: true,
//             flow_type: flowState?.flow_type
//           },
//         };
//       }

//     case "REGISTER":

//       const PAN = data.pan
//       updateUser(PAN, {"name": data.name, "password": data.password})
//       return {
//         screen: "SECURITY",
//         data: {
//           pan: PAN
//         }
//       };

//     case "SECURITY":
//       console.log("Data Received: ", data)

//       const pan = data.pan;

//       // Create the questions array
//       const questions = Object.keys(data)
//         .filter(key => key !== 'pan')  // Exclude the 'pan' field
//         .map(key => ({ question: key, answer: data[key] }));
//       updateUser(pan, {"questions": questions})
//       return {
//         screen: "LUFFY",
//         data: {
//           heading: "Congrats!",
//           text: "You have been successfully registered with our organization."
//         }
//       };

//     case "CHANGE_PASSWORD":
//       if (data.new_password !== data.confirm_password) {
//         return {
//           screen: "CHANGE_PASSWORD",
//           data: {
//             error: true,
//             message: "Passwords do not match"
//           }
//         };
//       }
//       updatePassword(data.phone, data.new_password)
//       // await updatePassword(flowStateStore.get(data.phone)?.phone, data.new_password);
//       flowStateStore.delete(data.phone);
      
//       return {
//         screen: "LOGIN",
//         data: {}
//       };

//     case "SECURITYQUESTION":
//       pan_no = data.pan
//       const question = data.question
//       const answer = data.answer
//       const userData = await axios.get(`http://localhost:8000/temp-flow-data/${pan_no}`)
      
//       const userQuestions = userData.data.questions;

//       // Find the matching question in the user's data
//       const matchedQuestion = userQuestions.find(q => q.question === question);

//       // Check if the answer matches
//       if (matchedQuestion && matchedQuestion.answer === answer) {
//         return {
//           screen: "LUFFY",
//           data: {
//             heading: "Welcome Back!",
//             text: "You have been successfully logged in."
//           }
//         };
//       } else {
//         return {
//           screen: "LUFFY",
//           data: {
//             heading: "Oops!",
//             text: "You have entered incorrect aswer to the security question. Please login again."
//           }
//         };
//       }

//     default:
//       break;
    
//   }
// }
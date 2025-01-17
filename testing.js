const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
const PORT = 8000;

const CAPTCHA_API_KEY = 'f682aadcd7cc86e07efd1341d90325ab';

let globalBrowser;  // Declare globalBrowser to hold the Puppeteer browser instance
let globalPage;

app.use(express.json());

async function getCaptchaToken(siteKey, url) {
  try {
    const res = await axios.get(
      `http://2captcha.com/in.php?key=${CAPTCHA_API_KEY}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${url}`
    );

    const requestId = res.data.split('|')[1];
    let token = null;

    for (let i = 0; i < 60; i++) {
      console.log("captcha number",i)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result = await axios.get(
        `http://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${requestId}`
      );
      if (result.data.includes('OK')) {
        token = result.data.split('|')[1];
        break;
      }
    }

    if (!token) throw new Error('Failed to solve reCAPTCHA in time.');
    return token;
  } catch (error) {
    console.error('Error solving CAPTCHA:', error.message);
    throw error;
  }
}


// async function selectSecurityQuestions(page) {
//     try {
//       // Define the mapping for the questions to be selected
//       const questionSelections = [
//         { dropdownSelector: 'div.MuiSelect-root[aria-labelledby="secret-question1"]', questionValue: "1" }, // Question 1
//         { dropdownSelector: 'div.MuiSelect-root[aria-labelledby="secret-question2"]', questionValue: "3" }, // Question 2
//         { dropdownSelector: 'div.MuiSelect-root[aria-labelledby="secret-question3"]', questionValue: "3" }, // Question 3
//         { dropdownSelector: 'div.MuiSelect-root[aria-labelledby="secret-question4"]', questionValue: "6" }, // Question 4
//       ];
  
//       // Loop through each dropdown and select the corresponding question
//       for (const { dropdownSelector, questionValue } of questionSelections) {
//         // Wait for the dropdown to appear
//         await page.waitForSelector(dropdownSelector);
  
//         // Click the dropdown to open it
//         await page.click(dropdownSelector);
//         console.log(`Clicked dropdown: ${dropdownSelector}`);
  
//         // Wait for the list of options to appear
//         const optionSelector = `ul.MuiList-root.MuiMenu-list li[data-value="${questionValue}"]`;
//         await page.waitForSelector(optionSelector);
  
//         // Click the desired question
//         await page.click(optionSelector);
//         console.log(`Selected question with value: ${questionValue}`);
//       }
  
//       console.log('All questions selected successfully.');
//     } catch (error) {
//       console.error('Error selecting security questions:', error.message);
//     }
//   }

app.post('/signup',async(req,res) => {
    const { pan,mobile} = req.body;
    if (!pan || !mobile) {
        return res.status(400).json({ error: 'PAN and Mobile Number are required' });
      }
    
    if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
    }

    
    try {
    globalBrowser = await puppeteer.launch({ headless: false });
    const page = await globalBrowser.newPage();
    globalPage = page; // Store the page instance globally
    const url = 'https://app.mfcentral.com/investor/signup';

    await page.goto(url, { waitUntil: 'load' });


    const panInputSelector = 'input[name="pan"]';
    await page.waitForSelector(panInputSelector);
    await page.type(panInputSelector, pan, { delay: 150 });

    const mobileNumberSelector = 'input[name="mobile"]';
    await page.waitForSelector(mobileNumberSelector);
    await page.type(mobileNumberSelector,mobile,{delay:150});

    console.log('Waiting for reCAPTCHA...');
    const siteKey = '6LdjYdkbAAAAAIgH8gQFMONZ8PAR7POFTAfKZ6xB';
    const token = await getCaptchaToken(siteKey, url);
    console.log('Captcha solved. Token:', token);

    await page.evaluate((captchaToken) => {
      window.___grecaptcha_cfg.clients[0].P.P.callback(captchaToken);
    }, token);

    console.log('Injected reCAPTCHA token.');

    const agreeTerms = 'input[name="agreeTerms"]';
    await page.waitForSelector(agreeTerms);
    await page.click(agreeTerms);

    console.log('Clicked on the checkbox.');

    const submitButtonSelector = 'button#submit-id';
    await page.waitForSelector(submitButtonSelector);
    await page.click(submitButtonSelector);


    res.json({ success: true, message: 'Enter OTP sent to your mobile number' });
    } catch (error) {
    console.error('Error in signup process:', error.message);
    res.status(500).json({ success: false, error: error.message });
    }

    
});


// Endpoint to handle OTP verification (works with multiple input fields)
app.post('/verify-otp', async (req, res) => {
    const { otp } = req.body;
  
    if (!otp || otp.length !== 6) { // Assuming OTP is 6 digits
      return res.status(400).json({ error: 'Enter a valid 6-digit OTP' });
    }
  
    try {
      const page = globalPage; // Get the global page instance from the previous step
      if (!page) {
        return res.status(400).json({ error: 'No ongoing signup process. Please start again.' });
      }
  
      // Select all input fields inside the .otp-inputs div
      const otpInputSelectors = 'div.otp-inputs input[type="text"]'; // Selector for the OTP inputs
  
      await page.waitForSelector(otpInputSelectors); // Wait for the OTP inputs to be available
  
      // Loop through each digit of the OTP and fill in the corresponding input field
      const otpDigits = otp.split('');
      for (let i = 0; i < otpDigits.length; i++) {
        const otpField = await page.$$(otpInputSelectors); // Get all OTP input fields
        await otpField[i].type(otpDigits[i], { delay: 100 }); // Type the OTP digit with a delay
      }
  
      // After filling in the OTP, find the submit button and click it
      const submitOtpButtonSelector = 'button#submit-id'; // Replace with actual OTP submit button selector
      await page.waitForSelector(submitOtpButtonSelector);
      await page.click(submitOtpButtonSelector);
  
      // Optionally, check for success or failure after submitting OTP
      // If successful, you may want to navigate to the dashboard or return a success message
      await page.waitForNavigation({ waitUntil: 'load' });
  
      // Example: returning a success message
      res.json({ success: true, message: 'OTP verified successfully' });
  
    } catch (error) {
      console.error('Error in OTP verification process:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });


// Endpoint to set display name and password, with password confirmation and validation
app.post('/set-password', async (req, res) => {
    const { displayName, password,confirmPassword } = req.body;
  
    // Validate required fields
    if (!displayName || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Display name, password, and confirm password are required' });
    }
    
    // Validate password and confirm password match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and confirm password do not match' });
    }
  
    // Password validation criteria
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long, contain one uppercase letter, one lowercase letter, one numeric value, and one special character from [!,@,#,$,%,^,&,*,)]',
      });
    }
  
    try {
      const page = globalPage; // Get the global page instance from the previous step
      if (!page) {
        return res.status(400).json({ error: 'No ongoing signup process. Please start again.' });
      }
  
      // Set the display name
      const displayNameSelector = 'input[name="displayName"]'; // Replace with actual selector
      await page.waitForSelector(displayNameSelector);
      await page.type(displayNameSelector, displayName, { delay: 150 });
  
      // Set the password
      const passwordSelector = 'input[name="password"]'; // Replace with actual selector
      await page.waitForSelector(passwordSelector);
      await page.type(passwordSelector, password, { delay: 150 });
  
      // Set the confirm password
      const confirmPasswordSelector = 'input[name="confirmPassword"]'; // Replace with actual selector
      await page.waitForSelector(confirmPasswordSelector);
      await page.type(confirmPasswordSelector, confirmPassword, { delay: 150 });
  
      const submitButtonSelector = 'button#submit-id'; // Replace with the actual submit button selector

      try {
        console.log('Waiting for the submit button to appear...');
        
        // Wait for the submit button to be visible
        await page.waitForSelector(submitButtonSelector);
        console.log('Submit button found!');

        // Click the submit button
        await page.click(submitButtonSelector);
        console.log('Submit button clicked!');

        } catch (error) {
        console.error('Error occurred during form submission:', error.message);
        }
  
      // Optionally, wait for navigation or success message
      await page.waitForNavigation({ waitUntil: 'load' });
  
      // Return success response
      res.json({ success: true, message: 'Display name and password set successfully!' });
  
    } catch (error) {
      console.error('Error in set password process:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

app.post('/security-questions', async (req, res) => {
    const { questions } = req.body; // Expecting an array of { questionValue, answer }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: 'Questions array is required and must be non-empty.' });
    }

    try {
        const page = globalPage; // Get the global page instance from the previous step
        if (!page) {
            return res.status(400).json({ error: 'No ongoing signup process. Please start again.' });
        }

        // Loop through each question and answer
        for (let i = 0; i < questions.length; i++) {
            const { questionValue, answer } = questions[i];

            // Validate the input
            if (!questionValue || !answer) {
                return res.status(400).json({ error: `Question and answer are required for index ${i}` });
            }

            console.log("question value",questionValue)
            console.log("answer",answer)
             // Extract the question number if present
            const questionNumberMatch = questionValue.match(/(\d+)/);
            if (questionNumberMatch) {
                 const questionNumber = parseInt(questionNumberMatch[1]);
 
                 // Tabbing to the dropdown (assuming N tabs to reach the first question dropdown)
                 for (let j = 0; j < questionNumber - 1; j++) {
                     await page.keyboard.press('Tab');
                 }
 
                 // Simulate selecting the dropdown option
                 for (let j = 0; j < questionNumber - 1; j++) {
                     await page.keyboard.press('ArrowDown');
                 }
                 await page.keyboard.press('Enter');
 
                 // Tab to the answer field and type the answer
                 await page.keyboard.press('Tab');
                 await page.keyboard.type(answer);
 
                 console.log(`Answered Question ${questionNumber} successfully.`);
             } else {
                 console.error(`Invalid question format for question: ${questionValue}`);
                 return res.status(400).json({ error: `Invalid question format for question index ${i}` });
             }

        }

        console.log('All questions answered successfully.');
        await globalBrowser.close();
        res.json({ success: true, message: 'Security questions answered successfully.' });
    } catch (error) {
        console.error('Error answering security questions:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// app.post('/security-questions', async (req, res) => {
//     const { questions } = req.body; // Expecting an array of { questionValue, answer }

//     if (!questions || !Array.isArray(questions) || questions.length === 0) {
//         return res.status(400).json({ error: 'Questions array is required and must be non-empty.' });
//     }

//     try {
//         const page = globalPage; // Get the global page instance from the previous step
//         if (!page) {
//           return res.status(400).json({ error: 'No ongoing signup process. Please start again.' });
//         }
        
//         for (let i = 0; i < questions.length; i++) {
//         const { questionValue, answer } = questions[i];

//         // Validate the input
//         if (!questionValue || !answer) {
//             return res.status(400).json({ error: `Question and answer are required for index ${i}` });

//         }


//         console.log("question value",questionValue)
//         console.log("answer",answer)

//         // Construct the label text for the current question
//         const labelText = `Select Security Question ${i + 1}`;

//         // Find the label element based on its text (XPath)
//         const labelXPath = `//label[contains(text(), "${labelText}")]`;

//         // Find the dropdown associated with this question using XPath
//         const dropdownXPath = `//label[contains(text(), "${labelText}")]/following-sibling::div//div[contains(@class, 'MuiSelect-root')]`;

//         // Find the input field to type the answer (XPath)
//         const answerInputXPath = `//label[contains(text(), "Answer")]/following-sibling::div//input`;

//         // Find the option corresponding to the question value
//         const optionXPath = `//ul[contains(@class, 'MuiList-root')]//li[@data-value="${questionValue}"]`;

//         // Wait for the label element to be present
//         const labelElement = await page.$x(labelXPath);
//         if (labelElement.length > 0) {
//             // Click on the dropdown associated with the current question
//             await page.$x(dropdownXPath).then(elements => elements[0]?.click());
//             console.log(`Clicked dropdown for question ${i + 1}`);

//             // Wait for the options to be available and select the correct option
//             const optionElements = await page.$x(optionXPath);
//             if (optionElements.length > 0) {
//                 await optionElements[0].click();
//                 console.log(`Selected question value: ${questionValue}`);
//             }

//             // Type the answer into the input field for this question
//             const answerInputElement = await page.$x(answerInputXPath);
//             if (answerInputElement.length > 0) {
//                 await answerInputElement[0].type(answer, { delay: 100 });
//                 console.log(`Typed answer: ${answer}`);
//             }
//         } else {
//             console.error(`Label for ${labelText} not found.`);
//         }
//     }

//         console.log('All questions answered successfully.');
//         await browser.close();
//         res.json({ success: true, message: 'Security questions answered successfully.' });
//     } catch (error) {
//         console.error('Error answering security questions:', error.message);
//         res.status(500).json({ success: false, error: error.message });
//     }
// });



// Endpoint to initiate the process and return the question
app.post('/signin', async (req, res) => {
  const { pan, password } = req.body;

  if (!pan || !password) {
    return res.status(400).json({ error: 'PAN and password are required' });
  }

  try {
    globalBrowser = await puppeteer.launch({ headless: false });
    const page = await globalBrowser.newPage();
    globalPage = page; // Store the page instance globally
    const url = 'https://app.mfcentral.com/investor/signin';

    await page.goto(url, { waitUntil: 'load' });

    // Input PAN and Password
    const panInputSelector = 'input[name="userId"]';
    await page.waitForSelector(panInputSelector);
    await page.type(panInputSelector, pan, { delay: 150 });

    await page.type('input[name="password"]', password, { delay: 150 });

    console.log('Waiting for reCAPTCHA...');
    const siteKey = '6LdjYdkbAAAAAIgH8gQFMONZ8PAR7POFTAfKZ6xB';
    const token = await getCaptchaToken(siteKey, url);
    console.log('Captcha solved. Token:', token);

    await page.evaluate((captchaToken) => {
      window.___grecaptcha_cfg.clients[0].P.P.callback(captchaToken);
    }, token);

    console.log('Injected reCAPTCHA token.');

    const submitButtonSelector = 'button#submit-id';
    await page.waitForSelector(submitButtonSelector);
    await page.click(submitButtonSelector);

    // Wait for the alert box to appear if necessary
    try {
        await page.waitForSelector('#alert-box', { timeout: 300000 });
        
        // Extract the alert message
        const alertMessage = await page.evaluate(() => {
            const alertBox = document.querySelector('#alert-box');
            if (alertBox) {
                const messageElement = alertBox.querySelector('#alert-message');
                return messageElement ? messageElement.textContent.trim() : null;
            }
            return null;
        });

        if (alertMessage) {
            console.log('Alert Message:', alertMessage);
        } else {
            console.log('Alert box found, but no message available.');
        }
    } catch (error) {
        console.log('Alert box not found on the page.');
    }

 

    await page.waitForSelector('textarea#textinput');
    const extractedText = await page.evaluate(() => {
      const textarea = document.querySelector('textarea#textinput');
      return textarea ? textarea.value : 'Text not found';
    });

    console.log('Extracted text:', extractedText);

    res.json({ success: true, question: extractedText });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post('/submit', async (req, res) => {
    const { userAnswer } = req.body;
  
    if (!userAnswer) {
      return res.status(400).json({ error: 'User answer is required' });
    }
  
    if (!globalPage) {
      return res.status(400).json({ error: 'Session not found. Please start the process again.' });
    }
  
    try {
      const page = globalPage;
  
      // Input the user answer
      const passwordInputSelector = 'input#outlined-adornment-password';
      await page.click(passwordInputSelector);
      await page.type(passwordInputSelector, userAnswer, { delay: 100 });
  
      const submitButtonSelector =
        'button.MuiButtonBase-root.MuiButton-root.MuiButton-text.customBtn.MuiButton-fullWidth';
      await page.waitForSelector(submitButtonSelector);
      await page.click(submitButtonSelector);
  
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      

      // Perform post-answer actions
      console.log('Pressing Tab and Enter...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await page.keyboard.press('Tab'); // Move focus to the next element
      await page.keyboard.press('Enter'); // Simulate pressing Enter key


      await page.keyboard.press('Tab'); // Move focus to the next element
      await page.keyboard.press('Enter'); // Simulate pressing Enter key
      
  
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log('Navigating to the portfolio page...');
      await page.goto('https://app.mfcentral.com/portal/portfolio', { waitUntil: 'load' });
  
      console.log('Waiting for "Demat Holdings" button to be visible...');
      const dematButtonSelector = 'div.segmented-control-segment';
      await page.waitForSelector(dematButtonSelector);
  
      console.log('Clicking on "Demat Holdings"...');
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('div.segmented-control-segment');
        const dematButton = Array.from(buttons).find(
          (button) => button.textContent.trim() === 'Demat Holdings'
        );
        if (dematButton) dematButton.click();
      });
  
      console.log('Extracting portfolio data...');
      const extractedData = await page.evaluate(() => {
        const cards = document.querySelectorAll('.list-cards-single'); // Select all cards
        const results = [];
  
        cards.forEach((card) => {
          const companyName = card.querySelector('.list-cards-top h3')?.innerText?.trim();
          const holdingPercentage = card.querySelector('.list-cards-top p span')?.innerText?.trim();
          const investedValue = card.querySelector('.list-cards-bottom-info:nth-child(1) p')?.innerText?.trim();
          const marketValue = card.querySelector('.list-cards-bottom-info:nth-child(2) p')?.innerText?.trim();
          const gainLoss = card.querySelector('.list-cards-bottom-info:nth-child(3) p')?.innerText?.trim();
  
          results.push({
            companyName,
            holdingPercentage,
            investedValue,
            marketValue,
            gainLoss,
          });
        });
  
        return results;
      });
  
      console.log('Extracted Data:', extractedData);
 
    
        // Wait for the element to be available (optional, but useful in case it loads dynamically)
        await page.waitForSelector('button.profile-dropdown-btn img[alt="icon"]');

        // Execute the client-side JavaScript to click the element
        const elementClicked = await page.evaluate(() => {
            const element = document.querySelector('button.profile-dropdown-btn img[alt="icon"]');
            if (element) {
            element.click();
            return true; // Indicates that the element was clicked
            } else {
            console.log("Element not found.");
            return false; // Element was not found
            }
        });

        if (elementClicked) {
            console.log("Element was clicked.");
        }

        // Step 2: Wait for the dropdown menu to appear
        await page.waitForSelector('div.MuiPaper-root.MuiPopover-paper', { visible: true });
        console.log('Logout dropdown menu visible')

        // Step 3: Get all 'a' elements inside the dropdown and click the second one (Logout)
        const logoutLinks = await page.$$('div.MuiPaper-root.MuiPopover-paper li.MuiListItem-root a');
        if (logoutLinks && logoutLinks.length > 1) {
        await logoutLinks[1].click(); // Click the second 'a' element (Logout)
        console.log('Logged out successfully');
        } else {
        console.log("Logout link not found");
        }

      
      await page.close();
      globalPage = null;
      await globalBrowser.close();

      // Return the extracted portfolio data
      res.json({ success: true, portfolio: extractedData });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });


const http = require('http');

const server = http.createServer(app);

// Set a custom timeout (e.g., 5 minutes = 300000ms)
server.setTimeout(300000); 

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
// app.listen(PORT, () => {
// console.log(`Server running on http://localhost:${PORT}`);
// });

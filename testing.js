
const app = express();
const PORT = 8000;

const CAPTCHA_API_KEY = 'f682aadcd7cc86e07efd1341d90325ab';

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


async function findRecaptchaClients(page) {
  return await page.evaluate(() => {
    if (typeof ___grecaptcha_cfg !== 'undefined') {
      return Object.entries(___grecaptcha_cfg.clients).map(([cid, client]) => {
        const data = { id: cid, version: cid >= 10000 ? 'V3' : 'V2' };
        const objects = Object.entries(client).filter(([_, value]) => value && typeof value === 'object');

        objects.forEach(([toplevelKey, toplevel]) => {
          const found = Object.entries(toplevel).find(([_, value]) => (
            value && typeof value === 'object' && 'sitekey' in value && 'size' in value
          ));
          
          if (typeof toplevel === 'object' && toplevel instanceof HTMLElement && toplevel.tagName === 'DIV') {
              data.pageurl = toplevel.baseURI;
          }
          
          if (found) {
            const [sublevelKey, sublevel] = found;
            data.sitekey = sublevel.sitekey;
            const callbackKey = data.version === 'V2' ? 'callback' : 'promise-callback';
            const callback = sublevel[callbackKey];
            if (!callback) {
              data.callback = null;
            } else {
              const keys = [cid, toplevelKey, sublevelKey, callbackKey].map((key) => `['${key}']`).join('');
              data.callback = `___grecaptcha_cfg.clients${keys}`;
            }
          }
        });
        return data;
      });
    }
    return [];
  });
}



const PuppeteerInstanceManager = require('./PuppeteerInstanceManager');
const instanceManager = new PuppeteerInstanceManager();

app.post('/signin', async (req, res) => {
  const { pan, password, key } = req.body;
  if (!key) {
    return res.status(400).json({ success: false, error: 'Key is required' });
  }

  try {
    const { browser, page } = await instanceManager.createOrGetInstance(key);


    // Validate inputs
    if (!pan || !password) {
      return res.status(400).json({
        success: false,
        error: 'PAN and password are required'
      });
    }
    // PAN validation: Check if it is 10 characters long and alphanumeric
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i; // Typical PAN format (India)
    if (!panRegex.test(pan)) {
      await instanceManager.removeInstanceByKey(key);
      return res.status(400).json({
        success: false,
        error: 'PAN must be 10 characters long and in a valid alphanumeric format (e.g., ABCDE1234F)',
      });
    }

      // Navigation and form filling with better error handling
      console.log('Navigating to signin page...');
      await page.goto('https://app.mfcentral.com/investor/signin', {
          waitUntil: 'networkidle0',
          timeout: 200000 // 2 minute timeout for initial load
      });

      // Add error handlers for page events
      page.on('error', err => {
          console.error('Page error:', err);
          throw err;
      });

      page.on('pageerror', err => {
          console.error('Page error:', err);
          throw err;
      });

      // Fill PAN with retry logic
      await retryOperation(async () => {
          await page.waitForSelector('input[name="userId"]', { timeout: 30000 });
          await page.type('input[name="userId"]', pan ); //,{ delay: 100 }
      }, 3);

      // Fill password with retry logic
      await retryOperation(async () => {
          await page.waitForSelector('input[name="password"]', { timeout: 30000 });
          await page.type('input[name="password"]', password );//,{ delay: 100 }
      }, 3);

      console.log('Waiting for reCAPTCHA...');
      const recaptchaClients = await findRecaptchaClients(page);

      if (!recaptchaClients.length || !recaptchaClients[0].callback) {
        throw new Error('No reCAPTCHA callback found.');
      }

      const siteKey = recaptchaClients[0].sitekey;
      const callbackPath = recaptchaClients[0].callback;
      console.log('Using siteKey:', siteKey, 'Callback path:', callbackPath);

      // Solve reCAPTCHA
      const token = await Promise.race([
        getCaptchaToken(siteKey, 'https://app.mfcentral.com/investor/signin'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('CAPTCHA timeout')), 800000),
        ),
      ]);

      if (!token) {
        throw new Error('Failed to solve CAPTCHA');
      }

      console.log('Captcha solved. Token:', token);

      // Inject CAPTCHA token
      await page.evaluate((callbackPath, token) => {
        const callbackFunction = eval(callbackPath);
        callbackFunction(token);
      }, callbackPath, token);

      console.log('Injected CAPTCHA token.');
      // Submit form with retry logic
      await retryOperation(async () => {
          await page.waitForSelector('button#submit-id', { timeout: 100000 });
          await page.click('button#submit-id');
      }, 3);

      // Wait for security question with timeout
      const extractedText = await Promise.race([
          (async () => {
              await page.waitForSelector('textarea#textinput');
              return page.evaluate(() => {
                  const textarea = document.querySelector('textarea#textinput');
                  return textarea ? textarea.value : null;
              });
          })(),
          new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Security question timeout')), 500000)
          )
      ]);

      if (!extractedText) {
          throw new Error('Failed to extract security question');
      }

      console.log('Signin process completed successfully');
      return res.json({
          success: true,
          question: extractedText,
          key:key,
      });

  } catch (error) {
    console.error('Signin process failed:', error.message);

    await instanceManager.removeInstanceByKey(key);
    return res.status(error.message.includes('timeout') ? 408 : 500).json({
      success: false,
      error: error.message || 'An unexpected error occurred'
    });
  }
});
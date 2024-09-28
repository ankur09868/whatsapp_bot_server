import axios from 'axios';
import { travel_ticket_prompt, appointment_prompt } from './PROMPTS.js'


async function handleMediaUploads(mediaID, userSession) {
    const access_token = userSession.access_token;
    const openai_key = process.env.OPENAI_API_KEY;

    let headers = {
        Authorization: `Bearer ${access_token}`,
    };

    try {
        let response = await axios.get(`https://graph.facebook.com/v19.0/${mediaID}`, { headers });
        const mediaURL = response.data.url;
        console.log(mediaURL);

        response = await axios.get(mediaURL, { headers, responseType: 'arraybuffer' });
        const media = response.data;

        const base64Media = Buffer.from(media).toString('base64');

        const payload = {
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: travel_ticket_prompt,
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Media}`,
                            },
                        },
                    ],
                },
            ],
        };

        const openAIHeaders = {
            Authorization: `Bearer ${openai_key}`,
            'Content-Type': 'application/json',
        };

        response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers: openAIHeaders });

        let result = response.data.choices[0].message.content

        const startIndex =  result.indexOf('{')
        const endIndex = result.lastIndexOf('}') + 1;

        const resultJSON = JSON.parse(result.substring(startIndex, endIndex).trim())
        
        console.log(resultJSON)
        
        const query = `Which hotel should I stay in ${resultJSON.destination}?`
        const data = {query: query}
        headers = { 'X-Tenant-Id': 'll'}

        response = await axios.post('http://localhost:8000/query/', data, {headers:  headers})

        console.log(response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

const userSession = {
    access_token: 'EAAVZBobCt7AcBO8trGDsP8t4bTe2mRA7sNdZCQ346G9ZANwsi4CVdKM5MwYwaPlirOHAcpDQ63LoHxPfx81tN9h2SUIHc1LUeEByCzS8eQGH2J7wwe9tqAxZAdwr4SxkXGku2l7imqWY16qemnlOBrjYH3dMjN4gamsTikIROudOL3ScvBzwkuShhth0rR9P',
    bpid: '241683569037594',
};

const mediaID = 413636194744154;
await handleMediaUploads(mediaID, userSession);

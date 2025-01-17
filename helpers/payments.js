import { GoogleAuth } from 'google-auth-library';

async function getAccessToken() {
    // Path to the service account key JSON file
    const serviceAccountKeyFile = 'client_secret_667498046930-pm47qo2cfli55tr93q5crc233ttre072.apps.googleusercontent.com.json';

    // Authenticate and get the token
    const auth = new GoogleAuth({
        keyFile: serviceAccountKeyFile,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    console.log(`Access Token: ${token}`);
}

getAccessToken();

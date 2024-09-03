export async function getAccessToken(auth_code) {
    const client_id = '1546607802575879'; 
    const client_secret = '1cc11e828571e071c91f56da993bb60b'; 
    const redirect_uri = 'https://crm.nuren.ai//ll//chatbot'; 
  
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${client_secret}&code=${auth_code}`;
  
    try {
      const response = await axios.get(url);
      const data = response.data;
  
      if (response.status === 200) {
        return data.access_token;
      } else {
        throw new Error(`Error: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Failed to retrieve access token:', error);
      throw error;
    }
}
  
export async function getWabaID(access_token) {
    const url = `https://graph.facebook.com/v19.0/debug_token?input_token=${access_token}`;
    try {
      const response = await axios.get(url, {
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      });
      
      if (response.status === 200) {
        const data = response.data;
        const waba_id = data.granular_scopes[0].target_ids[0]
        if (data.data.length > 0) {
          return waba_id
        } else {
          throw new Error('No WABA ID found for this access token');
        }
      } else {
        throw new Error(`Error: ${response.data.error.message}`);
      }
    } catch (error) {
      console.error('Failed to retrieve WABA ID:', error);
      throw error;
    }
}


export async function getPhoneNumberID(access_token, waba_id) {
    const url = `https://graph.facebook.com/v18.0/${waba_id}/phone_numbers`;
  
    try {
      const response = await axios.get(url, {
        headers: {
          "Authorization": `Bearer ${access_token}`,
        },
      });
  
      if (response.status === 200) {
        const data = response.data;
        return data.data[0].id; 
      } else {
        throw new Error(`Error: ${response.data.error.message}`);
      }
    } catch (error) {
      console.error('Failed to retrieve phone number ID:', error);
      throw error;
    }
}

export async function registerAccount(business_phone_number_id, access_token){
    const url = `https://graph.facebook.com/v19.0/${business_phone_number_id}/register`;
    try{
        const response = await axios.post(url, {
            headers: {
                "Authorization": `Bearer ${access_token}`,
            }
        });
        if (response.status === 200) {
            const data = response.data;
            return data.data[0].id; 
        } else {
            throw new Error(`Error: ${response.data.error.message}`);
        }
    }catch (error) {
        console.error('Failed to retrieve phone number ID:', error);
        throw error;
      }
}

export async function postRegister(access_token, account_id){
    const url = `https://graph.facebook.com/v19.0/${account_id}/subscribed_apps?access_token=${access_token}`
    try{
        const response = await axios.get(url, {
            headers:{
                'Authorization': `Bearer ${access_token}`,
            }
        });
        if (response.status === 200) {
            const data = response.data;
            return data.data[0].id; 
        } else {
            throw new Error(`Error: ${response.data.error.message}`);
        }
    }catch (error) {
        console.error('Failed to retrieve phone number ID:', error);
        throw error;
    }
}


import axios from "axios";
export async function createTemplate(accessToken, name, category, allowCategoryChange = false, language, libraryTemplateName, libraryTemplateButtonInputs, components,  business_account_number_id) {
    const url = `https://graph.facebook.com/v20.0/${business_account_number_id}/message_templates`;
    
    // Prepare the request payload
    const data = {
      name: name,
      category: category,
      allow_category_change: allowCategoryChange,
      language: language,
      components: components
    };
  
    // Add optional fields only if they are provided
    if (libraryTemplateName) {
      data.library_template_name = libraryTemplateName;
    }
    if (libraryTemplateButtonInputs) {
      data.library_template_button_inputs = libraryTemplateButtonInputs;
    }
  
    // Set up the config for the axios request
    const config = {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
  
    try {
      // Make the POST request to the Facebook Graph API
      const response = await axios.post(url, data, config);
      return response.data;  // Return the API response data
    } catch (error) {
      console.error('Error creating message template:', error.response ? error.response.data : error.message);
      throw error;  // Rethrow the error to be handled by the caller
    }
  }
  
import messageQueue from "./queues/messageQueue.js"
import axios from "axios"

// Helper functions
import {setTemplate, sendMessageTemplate} from "./snm.js"
import updateStatus from "./misc.js"

// Worker to process jobs
messageQueue.process(async (job) => {
  const {
    bg_id,
    bg_name,
    template,
    business_phone_number_id,
    tenant_id,
    batch,
  } = job.data;

  const templateName = template.name;
  const otp = template?.otp;

  try {
    // Fetch tenant data (e.g., from cache or external API)
    const responseData = await getTenantData(business_phone_number_id);

    const access_token = responseData?.whatsapp_data[0]?.access_token;
    const account_id = responseData?.whatsapp_data[0]?.business_account_id;

    if (!access_token || !account_id) {
      throw new Error("Invalid tenant data. Missing access token or account ID.");
    }

    // Fetch template data
    const templateData = await getTemplateData(account_id, templateName, access_token);

    if (!templateData) {
      throw new Error("Template not found.");
    }

    // Process each phone number in the batch
    const results = await Promise.allSettled(
      batch.map(async (phoneNumber) => {
        try {
          const messageData = await setTemplate(
            templateData,
            phoneNumber,
            business_phone_number_id,
            access_token,
            otp
          );

          const sendMessageResponse = await sendMessageTemplate(
            phoneNumber,
            business_phone_number_id,
            messageData,
            access_token,
            null,
            tenant_id
          );

          const messageID = sendMessageResponse.data?.messages[0]?.id;

          if (messageID) {
            const broadcastGroup = {
              id: bg_id || null,
              name: bg_name || null,
              template_name: templateData?.name || null,
            };

            updateStatus(
              "sent",
              messageID,
              business_phone_number_id,
              phoneNumber,
              broadcastGroup,
              tenant_id,
              Date.now()
            );
          }

          return { phoneNumber, status: "success", messageID };
        } catch (error) {
          console.error(`Failed to send message to ${phoneNumber}: ${error.message}`);
          return { phoneNumber, status: "failed", error: error.message };
        }
      })
    );

    console.log("Batch processed:", results);

    return results;
  } catch (error) {
    console.error("Error processing job:", error.message);
    throw error;
  }
});

// Helper function to get tenant data
async function getTenantData(business_phone_number_id) {
  // Example cache or API fetch implementation
  const response = await axios.get("https://example.com/whatsapp_tenant", {
    headers: { bpid: business_phone_number_id },
  });
  return response.data;
}

// Helper function to get template data
async function getTemplateData(account_id, templateName, access_token) {
  const response = await axios.get(
    `https://graph.facebook.com/v16.0/${account_id}/message_templates?name=${templateName}`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  return response.data.data[0];
}

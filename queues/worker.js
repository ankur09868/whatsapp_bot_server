import { messageQueue, campaignQueue } from "./workerQueues.js";
import { setTemplate, sendMessageTemplate, updateStatus, getIndianCurrentTime, setTemplateData, sendMessage } from "./helpers.js";



messageQueue.process('message' ,async (job) => {
  const { bg_id, bg_name, templateData, business_phone_number_id, access_token, otp, tenant_id, phoneNumbers, batchSize} = job.data;

  console.log("Data Rcvd: ", job.data)

  const results = [];

  for (let i = 0; i < phoneNumbers.length; i += batchSize) {
    const batch = phoneNumbers.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (phoneNumber) => {
        try {
          const messageData = await setTemplate( templateData, phoneNumber, business_phone_number_id, access_token, tenant_id, otp );

          console.log("Message Data: ", JSON.stringify(messageData, null, 6));

          const sendMessageResponse = await sendMessageTemplate( phoneNumber, business_phone_number_id, messageData, access_token, null, tenant_id);

          const messageID = sendMessageResponse.data?.messages[0]?.id;

          if (messageID) {

            const broadcastGroup = {
              id: bg_id || null,
              name: bg_name || null,
              template_name: templateData?.name || null,
            };
            
            let timestamp = await getIndianCurrentTime()
            updateStatus( "sent", messageID, business_phone_number_id, phoneNumber, broadcastGroup, tenant_id, timestamp);
          }

          return { phoneNumber, status: "success", messageID };
        } catch (error) {
          console.error(`Failed to send message to ${phoneNumber}: ${error.message}`);
          return { phoneNumber, status: "failed", error: error.message };
        }
      })
    );

    results.push(...batchResults);

    if (i + batchSize < phoneNumbers.length) {
      console.log(`Waiting for 1 second before sending the next batch...`);
      await delay(1000); 
    }
  }

  return results;
});


campaignQueue.process('message', async (job) => {
  const { campaign, templateData, templateInfo } = job.data;

  for (const contact of campaign.contacts) {
    const key = `${campaign.bpid}_${contact}`;
    const userSession = await getSession(key);
    const messageData = await setTemplateData(templateData, contact, campaign.bpid, campaign.access_token);
    const message_id = await sendMessage(contact, campaign.bpid, messageData, campaign.access_token, campaign.tenant);

    userSession.templateInfo = templateInfo;
    userSession.lastMessageID = message_id;
    userSessions[key] = userSession;

    await addData(key, campaign.id);
}
})
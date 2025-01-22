import Queue from 'bull';
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// dotenv.config({path: '../.env'})
// dotenv.config()

dotenv.config({
  path: path.resolve(__dirname, '../.env'), // Adjust based on script location
});

export const messageQueue = new Queue('messageQueue', {
  redis: { 
    host: 'whatsappnuren.redis.cache.windows.net', 
    port: 6379,
    password: process.env.REDIS_PASSWORD
},
});

messageQueue.on('error', (err) => {
  console.error('Redis connection error in Message Queue:', err);
});
messageQueue.on('completed', (job, result) => {
  console.log(`Job completed with result: ${result}`);
});
messageQueue.on('failed', (job, err) => {
  console.error(`Job ${JSON.stringify(job, null, 5)} failed with error: ${err}`);
});
messageQueue.on('waiting', (jobId) => {
  console.log(`Job waiting to be processed: ${jobId}`);
});
messageQueue.on('active', (job, jobPromise) => {
  console.log(`Job ${job.id} is now active and being processed.`);
});
messageQueue.on('stalled', (job) => {
  console.log(`Job ${job.id} has stalled.`);
});
messageQueue.on('progress', (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});
messageQueue.on('removed', (job) => {
  console.log(`Job ${job.id} has been removed from the queue.`);
});
messageQueue.on('paused', () => {
  console.log('Queue processing has been paused.');
});
messageQueue.on('resumed', () => {
  console.log('Queue processing has been resumed.');
});
messageQueue.on('cleaned', (jobs, type) => {
  console.log(`Cleaned ${type} jobs:`, jobs);
});
messageQueue.on('drained', () => {
  console.log('The queue has been drained and is empty.');
});
messageQueue.on('removed', (job) => {
  console.log(`Job ${job.id} was removed from the queue.`);
});



import { createClient } from 'redis';

const client = createClient({
  url: 'redis://whatsappnuren.redis.cache.windows.net:6379',
  password: process.env.REDIS_PASSWORD, 
});

// Connect to Redis
client.on('error', (err) => console.error('Redis Client Error:', err));
await client.connect(); // Ensure the client is connected before using it

/**
 * Get a user session from Redis by key
 * @param {string} key - The Redis key
 * @returns {Promise<any>} - Parsed session data or null if the key doesn't exist
 */
export async function getCampaignUserSession(key) {
  try {
    const { bpid, phone } = key.split('_')
    const defaultValue = {
      bpid: bpid,
      phone: phone,
    }
    const result = await client.get(key);

    if (result) {
      return JSON.parse(result);
    }

    await setCampaignUserSession(key, defaultValue);

    return defaultValue;
  } catch (err) {
    console.error('Error getting or creating campaign user session:', err);
    throw err;
  }
}

/**
 * Set a user session in Redis
 * @param {string} key - The Redis key
 * @param {object} session - The session data to store
 */
export async function setCampaignUserSession(key, session) {
  try {
    await client.set(key, JSON.stringify(session));
    console.log(`Session set for key: ${key}`);
  } catch (err) {
    console.error('Error setting campaign user session:', err);
    throw err;
  }
}

export async function deleteCampaignUserSession(key) {
  try {
    await client.del(key); // Deletes the key from Redis
    console.log(`Session deleted for key: ${key}`);
  } catch (err) {
    console.error('Error deleting campaign user session:', err);
    throw err;
  }
}
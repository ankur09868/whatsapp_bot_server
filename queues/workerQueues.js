import Queue from 'bull';
import dotenv from 'dotenv'

dotenv.config()

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


export const campaignQueue = new Queue('campaignQueue', {
  redis: {
    host: 'whatsappnuren.redis.cache.windows.net',
    port: 6379,
    password: process.env.REDIS_PASSWORD
  }
})

campaignQueue.on('error', (err) => {
  console.error('Redis Connection Error in Campaign Queue: ', err)
})

import Queue from 'bull';
import dotenv from 'dotenv';

dotenv.config()
// Initialize the queue
export const messageQueue = new Queue('messageQueue', {
  redis: { 
    host: 'whatsappnuren.redis.cache.windows.net', 
    port: 6379 ,
    password: process.env.REDIS_PASSWORD
}, // Configure Redis connection
});


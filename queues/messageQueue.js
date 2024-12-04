import Queue from 'bull';

// Initialize the queue
export const messageQueue = new Queue('messageQueue', {
  redis: { 
    host: 'whatsappnuren.redis.cache.windows.net', 
    port: 6379 ,
    password: 'O6qxsVvcWHfbwdgBxb1yEDfLeBv5VBmaUAzCaJvnELM='
}, // Configure Redis connection
});


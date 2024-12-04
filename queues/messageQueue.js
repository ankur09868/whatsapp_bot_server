import Queue from 'bull';

// Initialize the queue
const messageQueue = new Queue('messageQueue', {
  redis: { 
    host: '127.0.0.1', 
    port: 6379 
}, // Configure Redis connection
});

module.exports = messageQueue;

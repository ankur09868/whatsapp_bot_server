#!/bin/bash
# Start both server and worker with PM2

# Start the server.js script
pm2 start server.js --name "server"

# Start the worker.js script
pm2 start queues/worker.js --name "worker"

# Save PM2 process list
pm2 save

# Start PM2 in daemon mode
pm2 startup

# Keep the shell script running (to prevent the container from exiting)
tail -f /dev/null

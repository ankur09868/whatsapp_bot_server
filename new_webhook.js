import express from "express";
import axios from "axios";
import NodeCache from 'node-cache';
import cors from 'cors';
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";

import { getAccessToken, getWabaID, getPhoneNumberID, registerAccount, postRegister } from "./login-flow.js";
import { setTemplate, sendNodeMessage, sendImageMessage, sendTextMessage, sendAudioMessage, sendVideoMessage, sendLocationMessage, fastURL, djangoURL} from "./snm.js"
import { sendMessage, sendMessageTemplate  } from "./send-message.js"; 
import  { sendProduct, sendBill} from "./product.js"
import { updateStatus, addDynamicModelInstance, addContact, executeFallback, saveMessage, sendNotification, updateLastSeen } from "./misc.js"
import { handleMediaUploads } from "./handle-media.js"
import {Worker, workerData} from "worker_threads"
import { messageQueue } from "./queues/messageQueue.js";
import { time } from "console";
import { notDeepEqual } from "assert";


export const messageCache = new NodeCache({ stdTTL: 600 });

const WEBHOOK_VERIFY_TOKEN = "COOL";
const PORT = 8080;
const app = express();
const httpServer = createServer(app);
const allowedOrigins = ['http://localhost:8080', 'http://localhost:5174', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'];

export const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5174', 'http://localhost:8080', 'http://localhost:5173', 'https://whatsappbotserver.azurewebsites.net','https://nuren.ai/'],
    methods: ['GET', 'POST']
  }
});

export let userSessions = new Map();


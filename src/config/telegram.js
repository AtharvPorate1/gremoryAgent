// src/bot.ts
import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN must be provided in environment variables');
}

// Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN);


// Function to send a message to a specific chat
export async function sendMessage(chatId, message) {
  try {
    await bot.telegram.sendMessage(chatId, message);
    console.log(`Message sent to ${chatId}`);
  } catch (err) {
    console.error(`Failed to send message to ${chatId}:`, err);
    throw err;
  }
}


// sendMessage('5284739416', 'Hello from the bot!')
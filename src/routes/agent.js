import { Router } from "express";
import { runAgent } from "../agent/core.js";
import { sendMessage } from "../config/telegram.js";
import dotenv from "dotenv";
dotenv.config();

const router = Router();
const telegramId = process.env.AGENT_TG_ID



/**
 * @route POST /
 * @description Handles general AI prompting via the getAgentResponse function.
 * @access Public
 *
 * @body {string} prompt - The prompt to send to the AI agent.
 *
 * @returns {Object} response - The AI agent's response to the prompt.
 *
 * @example
 * // Request Body
 * {
 *   "prompt": "Explain how recursion works in JavaScript."
 * }
 *
 * // Response Body
 * {
 *   "response": "Recursion in JavaScript is a function calling itself..."
 * }
 */
router.post("/prompt", async (req, res) => {
  // This function should not go in production
  const { prompt } = req.body;
  console.log("Received prompt:", prompt);
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await runAgent(prompt);
    console.log("Response:", response);
    sendMessage(telegramId, response);
    res.json({ response });
  } catch (error) {
    console.error("Error in POST /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/rebalance", async (req, res) => {
  const prompt = "rebalance my portfolio";

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await getAgentResponse(prompt);
    res.json({ response });
  } catch (error) {
    console.error("Error in POST /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

import { Router } from 'express';
import { getAgentResponse } from '../agent/core.js'; // Import the function from core.js

const router = Router();

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
router.post('/', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await getAgentResponse(prompt);
    res.json({ response });
  } catch (error) {
    console.error('Error in POST /:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




router.post('/rebalance', async (req, res) => {
    const prompt = "rebalance my portfolio";
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        const response = await getAgentResponse(prompt);
        res.json({ response });
    } catch (error) {
        console.error('Error in POST /:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
    });



export default router;

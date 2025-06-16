import { Router } from "express";
import { runAgent } from "../agent/core.js";
import { sendMessage } from "../config/telegram.js";
import dotenv from "dotenv";
import {
  createBalancePosition,
  // getUserPositions,
} from "../agent/meteoraActions.js";
import { executeTransaction } from "../agent/txExecutor.js";
import { connection, user } from "../config/config.js";
import { createPoolViaAPI, getPoolInfo } from "../lib/poolHelper.js";
dotenv.config();

const router = Router();
const telegramId = process.env.AGENT_TG_ID;

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
    await sendMessage( response );
    res.json({ response });
  } catch (error) {
    console.error("Error in POST /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// router.post("/sendmessage", async (req, res) => {
//   // This function should not go in production
//   const { prompt } = req.body;
//   console.log("Received prompt:", prompt);
//   if (!prompt) {
//     return res.status(400).json({ error: "Prompt is required" });
//   }

//   try {
//     // const response = await runAgent(prompt);
//     console.log("Response:", prompt);
//     sendMessage(telegramId, prompt);
//     const response = "Message sent successfully";
//     console.log("Response:", response);
//     res.json({ response });
//   } catch (error) {
//     console.error("Error in POST /:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

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

router.post("/add-liquidity", async (req, res) => {
  const { tokenAddress, amount } = req.body;
  if (!tokenAddress || !amount) {
    return res
      .status(400)
      .json({ error: "Token address and amount are required" });
  }

  try {
    const tx = await createBalancePosition(tokenAddress, amount);
    
    const result = await executeTransaction(
      connection,
      tx.createPositionTx,
      [user, tx.newBalancePosition],
      { skipPreflight: false, commitment: "confirmed" },
    );
    console.log(
      "Transaction executed successfully:",
      `https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"}`,
    );
    await sendMessage(

      `Liquidity added successfully: [explorer](https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"})`,
    );


    const poolInfo = await getPoolInfo(tokenAddress);
    const poolName = poolInfo && poolInfo.name ? poolInfo.name : "New Pool";
    console.log("Starting pool creation process...");
    //add worker to handle this later
    const poolcreationres = await createPoolViaAPI({
      name: poolName,
      poolAddress: tokenAddress,
      tgId: telegramId,
    });
    
    console.log("Pool creation process completed successfully.", poolcreationres);

    res.json({
      result: `Liquidity added successfully: https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"}`,
    });
  } catch (error) {
    console.error("Error in POST /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/close-position", async (req, res) => {
  const { tokenAddress, amount } = req.body;
  if (!tokenAddress || !amount) {
    return res
      .status(400)
      .json({ error: "Token address and amount are required" });
  }

  try {
    const tx = await createBalancePosition(tokenAddress, amount);

    const result = await executeTransaction(
      connection,
      tx.createPositionTx,
      [user, tx.newBalancePosition],
      { skipPreflight: false, commitment: "confirmed" },
    );
    console.log(
      "Transaction executed successfully:",
      `https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"}`,
    );
    await sendMessage(

      `Liquidity added successfully: [explorer](https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"})`,
    );
    res.json({
      result: `Liquidity added successfully: https://explorer.solana.com/tx/${result}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"}`,
    });
  } catch (error) {
    console.error("Error in POST /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// router.get("/get-positions", async (req, res) => {
//   try {
//     const poolAddress = req.body.poolAddress;
//     if (!poolAddress) {
//       return res.status(400).json({ error: "Pool address is required" });
//     }
//     // This is a placeholder for the actual logic to get positions
//     // You would typically fetch this from your database or blockchain
//     const positions = await getUserPositions(poolAddress);

//     res.json({ positions });
//   } catch (error) {
//     console.error("Error in GET /get-positions:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

export default router;

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { jupiter } from "@goat-sdk/plugin-jupiter";
import { orca } from "@goat-sdk/plugin-orca";
import { solana } from "@goat-sdk/wallet-solana";

import { Connection, Keypair } from "@solana/web3.js";
import base58 from "bs58";

import dotenv from "dotenv";
dotenv.config();

const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
console.log("Connected to Solana RPC:", process.env.SOLANA_RPC_URL);
const keypair = Keypair.fromSecretKey(base58.decode(process.env.SOLANA_PRIVATE_KEY));

let toolsPromise = null;
let conversationHistory = [];

// Initialize tools once and reuse
async function getTools() {
    if (!toolsPromise) {
        toolsPromise = getOnChainTools({
            wallet: solana({
                keypair,
                connection,
            }),
            plugins: [jupiter(), orca()],
        });
    }
    return toolsPromise;
}

/**
 * Get the assistant's response for a given prompt.
 * @param {string} prompt
 * @returns {Promise<string>} The assistant's response
 */
export async function getAgentResponse(prompt) {
    conversationHistory.push({ role: "user", content: prompt });

    const tools = await getTools();

    const result = await generateText({
        model: openai("gpt-4o-mini"),
        tools: tools,
        maxSteps: 10,
        prompt: `You are a based crypto degen assistant. You're knowledgeable about DeFi, NFTs, and trading. You use crypto slang naturally and stay up to date with Solana ecosystem. You help users with their trades and provide market insights. Keep responses concise and use emojis occasionally.

Previous conversation:
${conversationHistory.map((m) => `${m.role}: ${m.content}`).join("\n")}

Current request: ${prompt}`,
        onStepFinish: (event) => {
            // Optionally handle tool execution events
            // console.log("Tool execution:", event.toolResults);
        },
    });

    conversationHistory.push({
        role: "assistant",
        content: result.text,
    });

    return result.text;
}

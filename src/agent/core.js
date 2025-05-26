import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
// import { createBalancePosition } from "../actions";
import {
  createBalancePositionTool,
  getPositionsTool,
  removeLiquidityTool,
} from "./tools.js";

dotenv.config();

// 1. Initialize tools
const tools = [
  createBalancePositionTool,
  getPositionsTool,
  removeLiquidityTool,
];

// 2. Create the agent
async function createAgent() {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful DeFi assistant specialized in Solana liquidity pools.",
    ],
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini", // Recommended to use latest version
    temperature: 0,
    // apiKey is automatically read from process.env.OPENAI_API_KEY
  });

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: true, // Helpful for debugging
  });
}

// 3. Run the agent with relevant queries
export async function runAgent(prompt) {
  const agentExecutor = await createAgent();

  // Test with relevant DLMM queries
  const result1 = await agentExecutor.invoke({
    input: prompt || "Hello can you list what can you do?",
  });
  console.log("Result 1:", result1.output);

  
  return result1.output;
}

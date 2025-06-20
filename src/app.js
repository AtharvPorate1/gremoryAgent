import express from "express";
import dotenv from "dotenv";
import agentRoutes from "./routes/agent.js";
dotenv.config();
import cors from "cors";
import basicRebalance from "./lib/rebalance/basicRebalance.js";
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to our backend!" });
});

app.use("/api/agent", agentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});


console.log(await basicRebalance(
  "HTvjzsfX3yU6BUodCjZ5vZkUrAxMDTrBs3CJaq43ashR", // Example pool address
  "D4QqCRX2aPfLu9rqJy9rf9nFKsDoqL2yYByvVqDPxUQq" // Example position key
));

export default app;

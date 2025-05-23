import { DynamicStructuredTool } from "@langchain/core/tools";
import { createBalancePosition, getUserPositions, removeLiquidity } from "./meteoraActions.js";
// import { executeTransaction } from "../executor.js";
import { connection, user } from "../config/config.js";
import { executeTransaction } from "./txExecutor.js";

/**
 * Creates a balanced liquidity position in the DLMM pool
 * @returns {Promise<string>} JSON string with transaction result
 */
export const createBalancePositionTool = new DynamicStructuredTool({
  name: "create_balanced_position",
  description: "Creates a balanced liquidity position in the DLMM pool",
  schema: {
    type: "object",
    properties: {
      skipPreflight: {
        type: "boolean",
        description: "Whether to skip transaction preflight checks",
        default: false
      },
      commitment: {
        type: "string",
        enum: ["processed", "confirmed", "finalized"],
        description: "Transaction commitment level",
        default: "confirmed"
      }
    },
    required: [],
  },
  func: async ({ skipPreflight = false, commitment = "confirmed" } = {}) => {
    try {
      // 1. Create position instructions
      const result = await createBalancePosition();
      
      // 2. Execute transaction (will throw on failure)
      const signature = await executeTransaction(
        connection, 
        result.createPositionTx, 
        [user, result.newBalancePosition],
        { skipPreflight, commitment }
      );

      // 3. Return standardized success response
      return JSON.stringify({
        success: true,
        transaction: {
          signature: signature,
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta"}`
        },
        position: {
          publicKey: result.newBalancePosition.publicKey.toString()
        }
      });

    } catch (error) {
      // Return standardized error response
      return JSON.stringify({
        success: false,
        error: {
          name: error.name,
          message: error.message,
          ...(process.env.NODE_ENV === 'development' && {
            stack: error.stack,
            rpcEndpoint: connection.rpcEndpoint
          })
        },
        timestamp: new Date().toISOString()
      });
    }
  }
});





/**
 * Fetches user's liquidity positions from DLMM pool
 */
export const getPositionsTool = new DynamicStructuredTool({
  name: "get_liquidity_positions",
  description: "Fetches all liquidity positions for the current user in DLMM pool",
  schema: {
    type: "object",
    properties: {
      verbose: {
        type: "boolean",
        description: "Whether to include full position details",
        default: false
      }
    },
    required: [],
  },
  func: async ({ verbose = false }) => {
    try {
      const { userPositions } = await getUserPositions();
      
      return JSON.stringify({
        status: "success",
        positions: userPositions.map((p, index) => ({
          index,
          publicKey: p.publicKey.toString(),
          ...(verbose && {
            bins: p.positionData.positionBinData.length,
            createdAt: p.positionData.createdAt.toNumber(),
            binIds: p.positionData.positionBinData.map(b => b.binId)
          })
        })),
        count: userPositions.length
      });

    } catch (error) {
      return JSON.stringify({
        status: "error",
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      });
    }
  }
});



/**
 * Removes liquidity from a user position in DLMM pool
 */
export const removeLiquidityTool = new DynamicStructuredTool({
  name: "remove_liquidity",
  description: "Removes liquidity from a DLMM position. Automatically fetches positions if not specified.",
  schema: {
    type: "object",
    properties: {
      positionIndex: {
        type: "number",
        description: "Index of position to modify (from get_positions), defaults to 0 (first position)",
        default: 0
      },
      percentage: {
        type: "number",
        description: "Percentage of liquidity to remove (0-100), 100 = full close",
        minimum: 0,
        maximum: 100,
        default: 100
      },
      shouldClaimFees: {
        type: "boolean",
        description: "Whether to claim accumulated fees when removing",
        default: true
      }
    },
    required: [],
  },
  func: async ({ positionIndex = 0, percentage = 100, shouldClaimFees = true }) => {
    try {
      // 1. Always fetch fresh positions
      const { userPositions } = await getUserPositions();
      
      // 2. Validate position exists
      if (userPositions.length === 0) {
        throw new Error("No positions found for this user");
      }
      if (positionIndex >= userPositions.length) {
        throw new Error(`Position index ${positionIndex} out of range (found ${userPositions.length} positions)`);
      }

      // 3. Execute removal
      const position = userPositions[positionIndex];
      const removal = await removeLiquidity(position.publicKey.toString(), {
        liquidityPercentage: percentage,
        shouldClaimAndClose: shouldClaimFees
      });

      const signature = await executeTransaction(
        connection,
        removal.removeLiquidityTx,
        [user]
      );

      return JSON.stringify({
        status: "success",
        position: {
          index: positionIndex,
          publicKey: position.publicKey.toString()
        },
        percentageRemoved: percentage,
        transactionSignature: signature,
        explorerUrl: `https://explorer.solana.com/tx/${signature}`
      });

    } catch (error) {
      return JSON.stringify({
        status: "error",
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      });
    }
  }
});

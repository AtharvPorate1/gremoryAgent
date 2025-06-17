import BN from "bn.js";
import DLMM, {
  autoFillYByStrategy,
  getTokenDecimals,
  getTokensMintFromPoolAddress,
  StrategyType,
  // getPositionsByUserAndLbPair
} from "@meteora-ag/dlmm";
import { PublicKey, Keypair } from "@solana/web3.js";
import { connection, user, USDC_USDT_POOL } from "../config/config.js";
import { processEqualValueSwap } from "../lib/solTokenSplitter.js";
import { sendMessage } from "../config/telegram.js";

export async function createBalancePosition(poolAddress, amount) {
  try {
    const dlmm = DLMM.default;
    console.log("Creating balance position for pool:", poolAddress);
    const pool = new PublicKey(poolAddress);
    const newAmount = (Number(amount) - 0.0575) / 2; // Adjusted amount for equal value swap
    const poolInfo = await getTokensMintFromPoolAddress(connection, pool, {
      cluster: "mainnet-beta", // required to resolve the correct program ID
    });

    const tokenXDecimals = await getTokenDecimals(
      connection,
      poolInfo.tokenXMint,
    );
    await sendMessage(`splitting ${amount} sol into equal value swap`);
    // const tokenYDecimals = await getTokenDecimals(connection, poolInfo.tokenYMint);
    await processEqualValueSwap(
      Number(amount),
      poolInfo.tokenXMint.toString(),
      poolInfo.tokenYMint.toString(),
    );

    const dlmmPool = await dlmm.create(connection, pool);

    const activeBin = await dlmmPool.getActiveBin();
    const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
      Number(activeBin.price),
    );
    console.log("Active Bin Price (Per Token):", activeBinPricePerToken);

    const TOTAL_RANGE_INTERVAL = 10;
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const totalXAmount = new BN(newAmount * 10 ** tokenXDecimals);
    const totalYAmount = autoFillYByStrategy(
      activeBin.binId,
      dlmmPool.lbPair.binStep,
      totalXAmount,
      activeBin.xAmount,
      activeBin.yAmount,
      minBinId,
      maxBinId,
      StrategyType.Spot,
    );
    console.log("Total X Amount:", totalXAmount.toString());
    console.log("Total Y Amount:", totalYAmount.toString());
    const newBalancePosition = Keypair.generate();

    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newBalancePosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });
    console.log("Create Position Transaction:", createPositionTx);

    return { createPositionTx, newBalancePosition, positionPubKey: newBalancePosition.publicKey };
  } catch (error) {
    console.error("Error in createBalancePosition:", error);
    throw error;
  }
}

// createBalancePosition("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6", 0.02)

export async function createImbalancedPosition(baseMint) {
  try {
    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);

    const activeBin = await dlmmPool.getActiveBin();
    console.log(
      "Active Bin Price (Per Token):",
      dlmmPool.fromPricePerLamport(Number(activeBin.price)),
    );

    const TOTAL_RANGE_INTERVAL = 10;
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const totalXAmount = new BN(0.02 * 10 ** 9);
    const totalYAmount = new BN(0.5 * 10 ** 6);
    const newImbalancePosition = Keypair.generate();

    const createPositionTx =
      await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newImbalancePosition.publicKey,
        user: user.publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });

    return { createPositionTx, newImbalancePosition };
  } catch (error) {
    console.error("Error in createImbalancedPosition:", error);
    throw error;
  }
}

export async function getUserPositions(poolAddress) {
  try {
    const dlmm = DLMM.default;
    console.log("poolAddress:", poolAddress);
    const pool = new PublicKey(poolAddress);
    const dlmmPool = await dlmm.create(connection, pool);

    // Get all positions for the user
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      // user.publicKey,
      "FEZ9iQRnDBAWkj6dV47EKoB3L289s659PGr7CmV9j3Wa",
    );
    ge
    if (!userPositions || userPositions.length === 0) {
      console.log("No positions found for this user");
      return [];
    }

    // Format position data
    // const formattedPositions = userPositions.map(position => ({
    //   positionPubKey: position.publicKey,
    //   lbPair: position.positionData.lbPair,
    //   binData: position.positionData.positionBinData,
    //   createdAt: new Date(position.positionData.createdAt.toNumber() * 1000),
    //   lastUpdatedAt: new Date(position.positionData.lastUpdatedAt.toNumber() * 1000)
    // }));

    return { userPositions };
  } catch (error) {
    console.error("Error in getUserPositions:", error);
    throw error;
  }
}



export async function addLiquidityToPosition(
  positionPubKey,
  baseMint,
  strategyType = StrategyType.Spot,
) {
  try {
    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);
    console.log("positionPubKey:", positionPubKey);
    const activeBin = await dlmmPool.getActiveBin();
    console.log(
      "Active Bin Price:",
      dlmmPool.fromPricePerLamport(Number(activeBin.price)),
    );

    const TOTAL_RANGE_INTERVAL = 10;
    const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
    const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

    const totalXAmount = new BN(0.02 * 10 ** 9);
    const totalYAmount = autoFillYByStrategy(
      activeBin.binId,
      dlmmPool.lbPair.binStep,
      totalXAmount,
      activeBin.xAmount,
      activeBin.yAmount,
      minBinId,
      maxBinId,
      strategyType,
    );
    console.log("totalXAmount:", totalXAmount.toString());
    console.log("totalYAmount:", totalYAmount.toString());

    const addLiquidityTx = await dlmmPool.addLiquidityByStrategy({
      positionPubKey: new PublicKey(positionPubKey),
      user: user.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType,
      },
    });
    console.log("addLiquidityTx:", addLiquidityTx);
    return { addLiquidityTx, positionPubKey };
  } catch (error) {
    console.error("Error in addLiquidityToPosition:", error);
    throw error;
  }
}

export async function removeLiquidity(positionPubKey, options = {}) {
  try {
    const {
      shouldClaimAndClose = true,
      liquidityPercentage = 100, // 100% by default
      skipPreflight = false,
    } = options;

    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);

    // Get user positions
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey,
    );
    const userPosition = userPositions.find((pos) =>
      pos.publicKey.equals(new PublicKey(positionPubKey)),
    );
    console.log("User Position:", userPosition);
    if (!userPosition) {
      throw new Error(`Position ${positionPubKey} not found`);
    }

    if (
      !userPosition.positionData ||
      !userPosition.positionData.positionBinData
    ) {
      throw new Error(`Invalid position data for ${positionPubKey}`);
    }

    if (userPosition.positionData.positionBinData.length === 0) {
      throw new Error(`No bin data found for position ${positionPubKey}`);
    }

    // Get all bin IDs from the position and sort them
    const binIdsToRemove = userPosition.positionData.positionBinData
      .map((bin) => {
        if (typeof bin.binId === "undefined") {
          throw new Error(`Invalid bin data in position ${positionPubKey}`);
        }
        return bin.binId;
      })
      .sort((a, b) => a - b);

    console.log("Bin IDs to remove:", binIdsToRemove);

    // Calculate BPS (100% = 100 * 100 basis points)

    const fromBinId = binIdsToRemove[0];
    const toBinId = binIdsToRemove[binIdsToRemove.length - 1];

    const percentageToRemove = 100;
    const bpsToRemove = new BN(Math.floor(percentageToRemove * 100));

    // Create remove liquidity transaction
    const removeLiquidityTx = await dlmmPool.removeLiquidity({
      position: new PublicKey(positionPubKey),
      user: user.publicKey,
      fromBinId,
      toBinId,
      bps: bpsToRemove,
      shouldClaimAndClose: true,
    });

    console.log("Remove Liquidity Transaction:", removeLiquidityTx);

    return {
      removeLiquidityTx,
      positionPubKey,
      binIds: binIdsToRemove,
      liquidityPercentage,
      skipPreflight,
    };
  } catch (error) {
    console.error("Error in removeLiquidity:", error);
    throw error;
  }
}

export async function prepareClaimFees() {
  try {
    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);

    // Get all user positions
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey,
    );

    if (!userPositions || userPositions.length === 0) {
      throw new Error("No positions found to claim fees");
    }

    // Prepare claim transactions
    const claimFeeTxs = await dlmmPool.claimAllSwapFee({
      owner: user.publicKey,
      positions: userPositions,
    });

    return {
      claimFeeTxs,
      positionCount: userPositions.length,
    };
  } catch (error) {
    console.error("Error in prepareClaimFees:", error);
    throw error;
  }
}

export async function prepareClosePosition(positionPubKey, options = {}) {
  try {
    const { skipPreflight = false, commitment = "confirmed" } = options;

    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);

    // Verify position exists
    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      user.publicKey,
    );
    const positionExists = userPositions.some((pos) =>
      pos.publicKey.equals(new PublicKey(positionPubKey)),
    );
    console.log("Position exists:", positionExists);
    if (!positionExists) {
      throw new Error(
        `Position ${positionPubKey} not found or not owned by user`,
      );
    }

    console.log("Position PubKey:", new PublicKey(positionPubKey).toString());
    const closePositionTx = await dlmmPool.removeLiquidity({
      owner: user.publicKey,
      position: new PublicKey(positionPubKey), // Use the existing position key
    });
    console.log("Close position transaction:", closePositionTx);

    return {
      closePositionTx,
      positionPubKey,
      transactionConfig: {
        skipPreflight,
        commitment,
      },
    };
  } catch (error) {
    console.error("Error in prepareClosePosition:", error);
    throw error;
  }
}

export async function prepareSwap(amount, swapDirection, options = {}) {
  try {
    const {
      slippageBps = 50, // 0.5% slippage default
      skipPreflight = false,
    } = options;

    const dlmm = DLMM.default;
    const dlmmPool = await dlmm.create(connection, USDC_USDT_POOL);

    // Convert amount to BN with decimals
    const swapAmount = new BN(
      amount *
        10 **
          (swapDirection ? dlmmPool.tokenY.decimals : dlmmPool.tokenX.decimals),
    );
    const swapYtoX = Boolean(swapDirection); // true = Y→X, false = X→Y

    // Get required bin arrays
    const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);

    // Get swap quote with slippage protection
    const swapQuote = await dlmmPool.swapQuote(
      swapAmount,
      swapYtoX,
      new BN(slippageBps), // Slippage in basis points (1 = 0.01%)
      binArrays,
    );

    // Prepare swap transaction
    const swapTx = await dlmmPool.swap({
      inToken: swapYtoX ? dlmmPool.tokenY.publicKey : dlmmPool.tokenX.publicKey,
      binArraysPubkey: swapQuote.binArraysPubkey,
      inAmount: swapAmount,
      lbPair: dlmmPool.pubkey,
      user: user.publicKey,
      minOutAmount: swapQuote.minOutAmount,
      outToken: swapYtoX
        ? dlmmPool.tokenX.publicKey
        : dlmmPool.tokenY.publicKey,
    });

    return {
      swapTx,
      swapQuote,
      direction: swapYtoX ? "Y→X" : "X→Y",
      inputAmount: amount,
      minOutput:
        swapQuote.minOutAmount /
        10 ** (swapYtoX ? dlmmPool.tokenX.decimals : dlmmPool.tokenY.decimals),
      transactionConfig: { skipPreflight },
    };
  } catch (error) {
    console.error("Error in prepareSwap:", error);
    throw error;
  }
}

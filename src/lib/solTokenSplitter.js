import { PublicKey, SendTransactionError, VersionedTransaction, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { connection, user } from "../config/config.js";
import { sendMessage } from "../config/telegram.js";
import { getTokenDecimals } from "@meteora-ag/dlmm";


// const telegramId = process.env.AGENT_TG_ID;
const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Hardcoded SOL mint
const SOL_DECIMALS = 1_000_000_000; // 9 decimals

// Jupiter API URLs
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_SWAP_API = 'https://lite-api.jup.ag/swap/v1/swap';

// Fee constants
const BIN_FEE_SOL = 0.0575; // SOL
const SOL_LAMPORTS = 1_000_000_000;

// Token decimals mapping (for common tokens, can be expanded)
const KNOWN_TOKEN_DECIMALS = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1_000_000,    // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1_000_000,    // USDT
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 100_000,      // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 1_000_000,     // WIF
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 1_000_000,      // JUP
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 1_000_000,     // RAY
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': 1_000_000      // TRUMP
};

/**
 * Get token decimals
 * @param {string} mintAddress - Token mint address
 * @returns {number} Token decimals (defaults to 6 if unknown)
 */
async function getTokenDecimalsFromMint(mintAddress) {
    const decimals = await getTokenDecimals(connection,new PublicKey(mintAddress))
    if (decimals) {
        return 10 ** decimals;
    }
  return KNOWN_TOKEN_DECIMALS[mintAddress] || 1_000_000; // Default to 6 decimals
}

/**
 * Get quote from Jupiter API
 * @param {string} inputMint - Input token mint address
 * @param {string} outputMint - Output token mint address  
 * @param {number} amount - Amount in atomic units
 * @param {number} slippageBps - Slippage in basis points (default 50 = 0.5%)
 * @returns {Promise<Object>} Quote response from Jupiter
 */
async function getJupiterQuote(inputMint, outputMint, amount, slippageBps = 50) {



  try {
 const resolvedAmount = await Promise.resolve(amount);
    const url = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${resolvedAmount}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
    console.log(`Fetching Jupiter quote: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const quoteData = await response.json();
    return quoteData;
  } catch (error) {
    console.error('Error fetching Jupiter quote:', error);
    throw error;
  }
}

/**
 * Get token price in USDC for reference pricing
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<number>} Token price in USDC
 */
async function getTokenPriceInUsdc(tokenMint) {
  try {
    const tokenDecimals = await getTokenDecimalsFromMint(tokenMint);
    const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    // Ensure we have valid decimals
    if (!tokenDecimals) {
      throw new Error(`Could not determine decimals for token ${tokenMint}`);
    }

    const quote = await getJupiterQuote(
      tokenMint,
      usdcMint,
      tokenDecimals, // 1 token in atomic units
      50
    );
    
    if (!quote.outAmount) {
      throw new Error('Invalid quote response - missing outAmount');
    }

    const usdcDecimals = await getTokenDecimalsFromMint(usdcMint);
    const tokenPriceUsdc = parseInt(quote.outAmount) / usdcDecimals;
    return tokenPriceUsdc;
  } catch (error) {
    console.error(`Error getting token price for ${tokenMint}:`, error);
    throw error;
  }
}
/**
 * Calculate equal value split for SOL-[Token] pool
 * @param {number} solAmount - Total SOL amount to split
 * @param {string} targetTokenMint - Target token mint address
 * @returns {Promise<Object>} Quote data for both tokens
 */
async function getEqualValueQuotes_SolToken(solAmount, targetTokenMint) {
  try {
    const availableSol = solAmount - BIN_FEE_SOL;
    if (availableSol <= 0) {
      throw new Error('Insufficient SOL amount after deducting fees');
    }

    console.log(`Available SOL after fees: ${availableSol} SOL`);

    // Get current SOL price in USDC for reference
    const solPriceUsdc = await getTokenPriceInUsdc(SOL_MINT);
    if (isNaN(solPriceUsdc)) {
      throw new Error('Failed to get valid SOL price');
    }
    console.log(`Current SOL price: $${solPriceUsdc} USDC`);

    // Calculate half value in USD
    const totalValueUsdc = availableSol * solPriceUsdc;
    const halfValueUsdc = totalValueUsdc / 2;
    
    console.log(`Total value: $${totalValueUsdc} USDC`);
    console.log(`Half value each: $${halfValueUsdc} USDC`);

    // Calculate SOL amount for half value
    const solForHalf = halfValueUsdc / solPriceUsdc;
    const solLamports = Math.floor(solForHalf * SOL_LAMPORTS);

    // Remaining SOL to convert to target token
    const remainingSol = availableSol - solForHalf;
    const remainingSolLamports = Math.floor(remainingSol * SOL_LAMPORTS);

    console.log(`SOL to keep: ${solForHalf} SOL (${solLamports} lamports)`);
    console.log(`SOL to convert to target token: ${remainingSol} SOL (${remainingSolLamports} lamports)`);

    // Get quote for SOL to target token conversion
    const solToTokenQuote = await getJupiterQuote(
      SOL_MINT,
      targetTokenMint,
      remainingSolLamports,
      50
    );

    const expectedTokenOutput = parseInt(solToTokenQuote.outAmount) / getTokenDecimalsFromMint(targetTokenMint);

    return {
      totalSolInput: solAmount,
      feesDeducted: BIN_FEE_SOL,
      availableSol: availableSol,
      solPriceUsdc: solPriceUsdc,
      pairType: 'SOL-TOKEN',
      targetTokenMint: targetTokenMint,
      splits: {
        sol: {
          amount: solForHalf,
          lamports: solLamports,
          valueUsdc: halfValueUsdc
        },
        token: {
          solToConvert: remainingSol,
          solLamports: remainingSolLamports,
          expectedTokenOutput: expectedTokenOutput,
          valueUsdc: halfValueUsdc,
          quote: solToTokenQuote
        }
      }
    };

  } catch (error) {
    console.error(`Error calculating equal value quotes for SOL-${targetTokenMint}:`, error);
    throw error;
  }
}

/**
 * Calculate equal value split for [Token1]-[Token2] pool (converting all SOL)
 * @param {number} solAmount - Total SOL amount to convert and split
 * @param {string} token1Mint - First target token mint address
 * @param {string} token2Mint - Second target token mint address
 * @returns {Promise<Object>} Quote data for both tokens
 */
async function getEqualValueQuotes_TokenToken(solAmount, token1Mint, token2Mint) {
  try {
    const availableSol = solAmount - BIN_FEE_SOL;
    if (availableSol <= 0) {
      throw new Error('Insufficient SOL amount after deducting fees');
    }

    console.log(`Available SOL after fees: ${availableSol} SOL`);
    
    // Get current SOL price in USDC for reference
    const solPriceUsdc = await getTokenPriceInUsdc(SOL_MINT);
    console.log(`Current SOL price: $${solPriceUsdc} USDC`);

    // Calculate total value and half values
    const totalValueUsdc = availableSol * solPriceUsdc;
    const halfValueUsdc = totalValueUsdc / 2;
    
    console.log(`Total value: $${totalValueUsdc} USDC`);
    console.log(`Half value each: $${halfValueUsdc} USDC`);

    // Calculate SOL amounts for each half
    const solForToken1 = availableSol / 2;
    const solForToken2 = availableSol / 2;
    const solLamportsToken1 = Math.floor(solForToken1 * SOL_LAMPORTS);
    const solLamportsToken2 = Math.floor(solForToken2 * SOL_LAMPORTS);

    console.log(`SOL to convert to token1: ${solForToken1} SOL (${solLamportsToken1} lamports)`);
    console.log(`SOL to convert to token2: ${solForToken2} SOL (${solLamportsToken2} lamports)`);

    // Get quotes for both conversions
    const [solToToken1Quote, solToToken2Quote] = await Promise.all([
      getJupiterQuote(SOL_MINT, token1Mint, solLamportsToken1, 50),
      getJupiterQuote(SOL_MINT, token2Mint, solLamportsToken2, 50)
    ]);

    const expectedToken1Output = parseInt(solToToken1Quote.outAmount) / getTokenDecimalsFromMint(token1Mint);
    const expectedToken2Output = parseInt(solToToken2Quote.outAmount) / getTokenDecimalsFromMint(token2Mint);

    return {
      totalSolInput: solAmount,
      feesDeducted: BIN_FEE_SOL,
      availableSol: availableSol,
      solPriceUsdc: solPriceUsdc,
      pairType: 'TOKEN-TOKEN',
      splits: {
        token1: {
          mint: token1Mint,
          solToConvert: solForToken1,
          solLamports: solLamportsToken1,
          expectedTokenOutput: expectedToken1Output,
          valueUsdc: halfValueUsdc,
          quote: solToToken1Quote
        },
        token2: {
          mint: token2Mint,
          solToConvert: solForToken2,
          solLamports: solLamportsToken2,
          expectedTokenOutput: expectedToken2Output,
          valueUsdc: halfValueUsdc,
          quote: solToToken2Quote
        }
      }
    };

  } catch (error) {
    console.error(`Error calculating equal value quotes for ${token1Mint}-${token2Mint}:`, error);
    throw error;
  }
}

/**
 * Main function to get equal value quotes for any token pair combination
 * @param {number} solAmount - Input SOL amount
 * @param {string} token1Mint - First token mint address (use SOL_MINT to keep some SOL)
 * @param {string} token2Mint - Second token mint address
 * @returns {Promise<Object>} Quote data for the token pair
 */
async function getEqualValueQuotes(solAmount, token1Mint, token2Mint) {
  console.log(`\n=== Getting quotes for ${token1Mint}-${token2Mint} pair ===`);
  console.log(`Input SOL amount: ${solAmount} SOL`);

  // Determine the split type
  if (token1Mint === SOL_MINT) {
    console.log("SOL-[Token] pair - keep some SOL, convert rest to token2")
    return await getEqualValueQuotes_SolToken(solAmount, token2Mint);
  } else if (token2Mint === SOL_MINT) {
    console.log("[Token]-SOL pair - keep some SOL, convert rest to token1")
    return await getEqualValueQuotes_SolToken(solAmount, token1Mint);
  } else {
    console.log("[Token1]-[Token2] pair - convert all SOL to both tokens equally");
    return await getEqualValueQuotes_TokenToken(solAmount, token1Mint, token2Mint);
  }
}

/**
 * Create serialized swap transaction using Jupiter Swap API
 * @param {Object} quoteResponse - Quote response from Jupiter Quote API
 * @param {string} userPublicKey - User's wallet public key
 * @param {Object} options - Additional options for transaction optimization
 * @returns {Promise<Object>} Swap response with serialized transaction
 */
async function createSwapTransaction(quoteResponse, userPublicKey, options = {}) {
  try {
    const {
      dynamicComputeUnitLimit = true,
      dynamicSlippage = true,
      maxLamports = 1000000,
      priorityLevel = "veryHigh"
    } = options;

    const swapRequestBody = {
      quoteResponse,
      userPublicKey,
      dynamicComputeUnitLimit,
      dynamicSlippage,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports,
          priorityLevel
        }
      }
    };

    console.log('Creating swap transaction...');

    const response = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(swapRequestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Swap API error! status: ${response.status}, message: ${errorText}`);
    }

    const swapResponse = await response.json();
    console.log('Swap transaction created successfully');
    
    return swapResponse;
  } catch (error) {
    console.error('Error creating swap transaction:', error);
    throw error;
  }
}

/**
 * Create token account if it doesn't exist
 * @param {string} mintAddress - Token mint address
 */
async function createTokenAccountIfNeeded(mintAddress) {
  try {
    const ata = await getAssociatedTokenAddress(
      new PublicKey(mintAddress),
      user.publicKey
    );
    
    const accountInfo = await connection.getAccountInfo(ata);
    if (!accountInfo) {
      console.log(`Creating token account for ${mintAddress}`);
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          user.publicKey,
          ata,
          user.publicKey,
          new PublicKey(mintAddress)
      ));
      await sendAndConfirmTransaction(connection, tx, [user]);
    }
  } catch (error) {
    console.error(`Token account check failed: ${error.message}`);
    throw error;
  }
}

/**
 * Process equal value swap between two tokens
 * @param {number} solAmount - Amount of SOL to swap
 * @param {string} token1Mint - First token mint address
 * @param {string} token2Mint - Second token mint address
 * @param {string} userPublicKey - User's public key
 * @param {Object} swapOptions - Options for swap transaction
 * @param {Object} executeOptions - Options for transaction execution
 * @returns {Promise<Object>} Result of the swap operation
 */
export async function processEqualValueSwap(
  solAmount,
  token1Mint,
  token2Mint,
  userPublicKey=user.publicKey.toString(),
  swapOptions = {},
  executeOptions = {}
) {
  try {
    console.log(`\n=== Processing ${token1Mint}-${token2Mint} equal value swap ===`);
    console.log(`Input SOL amount: ${solAmount}`);
    console.log(`User: ${userPublicKey}`);

    // Check SOL balance
    const balance = await connection.getBalance(new PublicKey(userPublicKey));
    const minRequired = (solAmount + BIN_FEE_SOL) * SOL_LAMPORTS;
    
    if (balance < minRequired) {
      const msg = `Insufficient SOL balance. Need ${minRequired/SOL_LAMPORTS} SOL (Have ${balance/SOL_LAMPORTS} SOL)`;
      if (telegramId) await sendMessage( msg);
      throw new Error(msg);
    }

    // Ensure token accounts exist
    if (token1Mint !== SOL_MINT) {
      await createTokenAccountIfNeeded(token1Mint);
    }
    if (token2Mint !== SOL_MINT) {
      await createTokenAccountIfNeeded(token2Mint);
    }

    // Get quotes
    const quoteResult = await getEqualValueQuotes(solAmount, token1Mint, token2Mint);
    const transactionsToExecute = [];

    // Create transactions
    if (quoteResult.pairType === 'SOL-TOKEN') {
      const targetSplit = quoteResult.splits.token;
      const swapTx = await createSwapTransaction(
        targetSplit.quote,
        userPublicKey,
        swapOptions
      );
      transactionsToExecute.push({
        type: `SOL_TO_TOKEN`,
        swapTransaction: swapTx.swapTransaction
      });
    } else {
      const [swapTx1, swapTx2] = await Promise.all([
        createSwapTransaction(quoteResult.splits.token1.quote, userPublicKey, swapOptions),
        createSwapTransaction(quoteResult.splits.token2.quote, userPublicKey, swapOptions)
      ]);
      transactionsToExecute.push(
        { type: `SOL_TO_TOKEN1`, swapTransaction: swapTx1.swapTransaction },
        { type: `SOL_TO_TOKEN2`, swapTransaction: swapTx2.swapTransaction }
      );
    }

    // Execute transactions
    const executionResults = [];
    for (const tx of transactionsToExecute) {
      try {
        console.log(`\nExecuting ${tx.type}...`);
        
        // Deserialize and sign
        const transaction = VersionedTransaction.deserialize(
          Buffer.from(tx.swapTransaction, 'base64')
        );
        transaction.sign([user]);

        // Simulate first
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }

        // Execute
        const signature = await connection.sendTransaction(transaction, {
          skipPreflight: false,
          ...executeOptions
        });

        // Confirm
        const confirmation = await connection.confirmTransaction(
          signature,
          executeOptions.commitment || 'confirmed'
        );

        executionResults.push({
          type: tx.type,
          success: true,
          signature,
          url: `https://solscan.io/tx/${signature}`,
          confirmation
        });

        console.log(`✅ Success: ${signature}`);

      } catch (error) {
        const errorMsg = error instanceof SendTransactionError 
          ? `${error.message}\nLogs: ${error.logs?.join('\n') || 'none'}`
          : error.message;

        console.error(`❌ Failed: ${errorMsg}`);

        executionResults.push({
          type: tx.type,
          success: false,
          error: errorMsg
        });

        // Abort if first tx fails
        if (tx === transactionsToExecute[0]) break;
      }
    }

    return {
      quotes: quoteResult,
      executions: executionResults,
      summary: {
        totalSolInput: solAmount,
        feesDeducted: BIN_FEE_SOL,
        successCount: executionResults.filter(r => r.success).length,
        failureCount: executionResults.filter(r => !r.success).length,
        netSolBalance: balance/SOL_LAMPORTS - solAmount - BIN_FEE_SOL
      }
    };

  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  }
}
// await processEqualValueSwap(
//   0.1, // 1 SOL
//   'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC mint
//   'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK mint
//   user.publicKey.toString()
// );

// console.log(await getTokenDecimalsFromMint(connection, new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"))); // USDC mint

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SOL_MINT,
    processEqualValueSwap,
    getEqualValueQuotes,
    createSwapTransaction,
    getJupiterQuote,
    getTokenPriceInUsdc,
    getTokenDecimalsFromMint
  };
}
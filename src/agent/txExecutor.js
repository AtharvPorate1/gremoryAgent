import { sendAndConfirmTransaction } from "@solana/web3.js";

/**
 * Executes a transaction with proper error handling
 * @param {Connection} connection - Solana connection
 * @param {Transaction | Transaction[]} transaction - Transaction(s) to execute
 * @param {Keypair[]} signers - Required signers
 * @param {Object} [options] - Execution options
 * @returns {Promise<string|string[]>} Transaction hash(es)
 * @throws {Error} If transaction execution fails
 */
export async function executeTransaction(
  connection,
  transaction,
  signers,
  options = {},
) {
  try {
    const txs = Array.isArray(transaction) ? transaction : [transaction];
    const txHashes = [];

    for (const tx of txs) {
      const txHash = await sendAndConfirmTransaction(connection, tx, signers, {
        skipPreflight: options.skipPreflight || false,
        commitment: options.commitment || "confirmed",
      });
      txHashes.push(txHash);
      console.log(`Transaction executed: ${txHash}`);
    }

    return txHashes.length === 1 ? txHashes[0] : txHashes;
  } catch (error) {
    console.error("Execution failed:", error);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

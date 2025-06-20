import dotenv from "dotenv";

dotenv.config();

/**
 * Creates a new pool via API call to localhost
 * @async
 * @function createPoolViaAPI
 * @param {Object} params - Pool creation parameters
 * @param {string} params.name - Name of the pool
 * @param {string} params.poolAddress - Blockchain address of the pool
 * @param {string|number|bigint} params.tgId - User's Telegram ID
 * @returns {Promise<Object>} API response data
 * @throws {Error} If the API request fails or returns an error
 * @example
 * // Basic usage
 * createPoolViaAPI({
 *   name: "ETH-USDC Pool",
 *   poolAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *   tgId: "1234567890"
 * }).then(console.log).catch(console.error);
 */
export async function createPoolViaAPI({ name, poolAddress, tgId, positionPubKey }) {
  // Validate required parameters
  if (!name || !poolAddress || !tgId) {
    throw new Error("Missing required parameters: name, poolAddress, or tgId");
  }
  console.log("Creating pool via API with params:", {
    name,
    poolAddress,
    tgId,
    positionPubKey,
  });
  try {
    const response = await fetch(
      "https://fd3c-2402-8100-3146-a64-fc3b-e7b8-5953-93e1.ngrok-free.app/api/agent/add-pool",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          poolAddress,
          tgId: tgId.toString(),
          positionKey: positionPubKey // Ensure tgId is stringified (handles bigint)
        }),
      },
    );

    const data = await response.json();

    // Handle API error responses
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Failed to create pool");
    }

    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error(`Pool creation failed: ${error.message}`);
  }
}


export async function removePoolViaAPI({ positionKey, tgId }) {
  // Validate required parameters
  if (!positionKey || !tgId) {
    throw new Error("Missing required parameters: positionKey or tgId");
  }
  
  console.log("Removing pool via API with params:", {
    positionKey,
    tgId,
  });

  try {
    const response = await fetch(
      "https://fd3c-2402-8100-3146-a64-fc3b-e7b8-5953-93e1.ngrok-free.app/api/agent/remove-pool",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          positionKey,
          tgId: tgId.toString() // Ensure tgId is stringified (handles bigint)
        }),
      }
    );

    const data = await response.json();

    // Handle API error responses
    if (!response.ok || data.error) {
      throw new Error(data.error || "Failed to remove pool");
    }

    return data;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error(`Pool removal failed: ${error.message}`);
  }
}




/**
 * Fetches pool information from Meteora API for a given pair address.
 * @async
 * @function getPoolInfo
 * @param {string} pairAddress - The address of the pool pair.
 * @returns {Promise<Object>} The pool information from the API.
 * @throws {Error} If the API request fails or returns an error.
 * @example
 * getPoolInfo("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6").then(console.log).catch(console.error);
 */
export async function getPoolInfo(pairAddress) {
  if (!pairAddress) {
    throw new Error("Missing required parameter: pairAddress");
  }

  try {
    const response = await fetch(
      `https://dlmm-api.meteora.ag/pair/${pairAddress}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch pool info: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch pool info:", error);
    throw new Error(`getPoolInfo failed: ${error.message}`);
  }
}

// const poolInfo = await getPoolInfo("5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6")
// const { address, mint_x, mint_y } = poolInfo;
// console.log("Pool Address:", address);
// console.log("Mint X:", mint_x);
// console.log("Mint Y:", mint_y);


/**
 * Fetches pools to rebalance for a given Telegram ID.
 * @async
 * @function getPoolsToRebalance
 * @param {string|number|bigint} tgId - User's Telegram ID.
 * @returns {Promise<Array>} Array of pool info arrays.
 * @throws {Error} If the API request fails or returns an error.
 * @example
 * getPoolsToRebalance("5284739416").then(console.log).catch(console.error);
 */
export async function getPoolsToRebalance(tgId) {
    if (!tgId) {
        throw new Error("Missing required parameter: tgId");
    }
    try {
        const response = await fetch(
            "http://localhost:3000/api/pool/getpoolstorebalance",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ tgId: tgId.toString() }),
            }
        );
        if (!response.ok) {
            throw new Error(`Failed to fetch pools to rebalance: ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch pools to rebalance:", error);
        throw new Error(`getPoolsToRebalance failed: ${error.message}`);
    }
}

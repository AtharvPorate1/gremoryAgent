import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import dotenv from "dotenv";
dotenv.config();

/**
 * Decrypts a message using HPKE (Hybrid Public Key Encryption).
 *
 * Uses P-256 keys with HPKE to decrypt an encrypted message. The function expects base64-encoded
 * inputs and handles all necessary key imports and context creation for HPKE decryption.
 *
 * @param privateKeyBase64 Base64-encoded private key in PKCS8 format used for decryption.
 * @param encapsulatedKeyBase64 Base64-encoded raw public key bytes representing the
 *     encapsulated key.
 * @param ciphertextBase64 Base64-encoded encrypted message using base64url encoding that
 *     will be decrypted.
 * @returns A Promise that resolves to the decrypted message as a UTF-8 string.
 * @throws {Error} If decryption fails or if any of the inputs are incorrectly formatted.
 */
async function decryptHPKEMessage(
  privateKeyBase64,
  encapsulatedKeyBase64,
  ciphertextBase64,
) {
  try {
    // Validate inputs
    if (!privateKeyBase64 || !encapsulatedKeyBase64 || !ciphertextBase64) {
      throw new Error('Missing required parameters for HPKE decryption');
    }

    // Initialize the cipher suite
    const suite = new CipherSuite({
      kem: new DhkemP256HkdfSha256(),
      kdf: new HkdfSha256(),
      aead: new Chacha20Poly1305(),
    });

    // Convert base64 to ArrayBuffer with better error handling
    const base64ToBuffer = (base64, paramName = 'parameter') => {
      try {
        const cleanBase64 = base64.replace(/\s/g, '');
        return Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0)).buffer;
      } catch (error) {
        throw new Error(`Invalid base64 encoding for ${paramName}: ${error.message}`);
      }
    };

    // Clean and validate the private key
    const cleanPrivateKey = privateKeyBase64.replace(/\s/g, '');
    
    // Import private key using WebCrypto with better error handling
    let privateKey;
    try {
      privateKey = await crypto.subtle.importKey(
        "pkcs8",
        base64ToBuffer(cleanPrivateKey, 'private key'),
        {
          name: "ECDH",
          namedCurve: "P-256",
        },
        true,
        ["deriveKey", "deriveBits"],
      );
    } catch (keyError) {
      throw new Error(`Failed to import private key: ${keyError.message}`);
    }

    // Create recipient context and decrypt
    const recipient = await suite.createRecipientContext({
      recipientKey: privateKey,
      enc: base64ToBuffer(encapsulatedKeyBase64, 'encapsulated key'),
    });

    const decryptedBuffer = await recipient.open(
      base64ToBuffer(ciphertextBase64, 'ciphertext')
    );

    return new TextDecoder().decode(decryptedBuffer);
    
  } catch (error) {
    console.error('HPKE Decryption Error:', error);
    throw new Error(`Failed to decrypt HPKE message: ${error.message}`);
  }
}

// Environment variable validation
const privateKeyBase64 = process.env.SECRET_DECRYPTER_KEY;
const agentCiphertext = process.env.AGENT_CIPHERTEXT;
const agentEncapsulatedKey = process.env.AGENT_ENCAPSULATED_KEY;

if (!privateKeyBase64) {
  throw new Error('SECRET_DECRYPTER_KEY environment variable is not set');
}

if (!agentCiphertext) {
  throw new Error('AGENT_CIPHERTEXT environment variable is not set');
}

if (!agentEncapsulatedKey) {
  throw new Error('AGENT_ENCAPSULATED_KEY environment variable is not set');
}

// Debug logging (remove in production)
console.log('Environment variables loaded:');
console.log('- Private key length:', privateKeyBase64.length);
console.log('- Ciphertext length:', agentCiphertext.length);
console.log('- Encapsulated key length:', agentEncapsulatedKey.length);

const response = {
  encryption_type: "HPKE",
  ciphertext: agentCiphertext,
  encapsulated_key: agentEncapsulatedKey,
};

// Create the promise for the private key decryption
const privateKeyPromise = decryptHPKEMessage(
  privateKeyBase64,
  response.encapsulated_key,
  response.ciphertext,
).catch((error) => {
  console.error("Error decrypting message:", error);
  throw error;
});

export const getPrivateKey = async () => {
  return await privateKeyPromise;
};
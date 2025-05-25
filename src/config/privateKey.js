import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { createPrivateKey } from 'crypto';
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
    
    // Import private key using WebCrypto with multiple format attempts
    let privateKey;
    const keyBuffer = base64ToBuffer(cleanPrivateKey, 'private key');
    
    // Try different key import methods
    const importMethods = [
      { format: "pkcs8", name: "ECDH", curve: "P-256" },
      { format: "raw", name: "ECDH", curve: "P-256" },
      { format: "spki", name: "ECDH", curve: "P-256" }
    ];
    
    let lastError;
    for (const method of importMethods) {
      try {
        console.log(`Trying to import key with format: ${method.format}`);
        privateKey = await crypto.subtle.importKey(
          method.format,
          keyBuffer,
          {
            name: method.name,
            namedCurve: method.curve,
          },
          true,
          ["deriveKey", "deriveBits"],
        );
        console.log(`Successfully imported key with format: ${method.format}`);
        break;
      } catch (keyError) {
        console.log(`Failed with format ${method.format}:`, keyError.message);
        lastError = keyError;
        continue;
      }
    }
    
    if (!privateKey) {
      // Fallback: try using Node.js crypto directly
      try {
        console.log('Trying Node.js crypto fallback...');
        const keyBuffer = Buffer.from(cleanPrivateKey, 'base64');
        
        // Try different Node.js key formats
        const nodeFormats = [
          { format: 'der', type: 'pkcs8' },
          { format: 'der', type: 'sec1' },
          { format: 'pem', type: 'pkcs8' },
          { format: 'pem', type: 'sec1' }
        ];
        
        let nodePrivateKey;
        for (const fmt of nodeFormats) {
          try {
            console.log(`Trying Node.js format: ${fmt.format}/${fmt.type}`);
            
            let keyData = keyBuffer;
            if (fmt.format === 'pem') {
              // Convert to PEM format
              const base64Key = keyBuffer.toString('base64');
              const pemType = fmt.type === 'pkcs8' ? 'PRIVATE KEY' : 'EC PRIVATE KEY';
              keyData = `-----BEGIN ${pemType}-----\n${base64Key.match(/.{1,64}/g).join('\n')}\n-----END ${pemType}-----`;
            }
            
            nodePrivateKey = createPrivateKey({
              key: keyData,
              format: fmt.format,
              type: fmt.type
            });
            
            console.log(`Successfully created Node.js private key with ${fmt.format}/${fmt.type}`);
            
            // Convert Node.js key to WebCrypto format
            const jwk = nodePrivateKey.export({ format: 'jwk' });
            privateKey = await crypto.subtle.importKey(
              'jwk',
              jwk,
              {
                name: 'ECDH',
                namedCurve: 'P-256',
              },
              true,
              ['deriveKey', 'deriveBits']
            );
            console.log('Successfully converted to WebCrypto key');
            break;
            
          } catch (nodeError) {
            console.log(`Node.js format ${fmt.format}/${fmt.type} failed:`, nodeError.message);
            continue;
          }
        }
        
        if (!privateKey) {
          throw new Error('All Node.js fallback methods failed');
        }
        
      } catch (fallbackError) {
        throw new Error(`All key import methods failed. Fallback error: ${fallbackError.message}`);
      }
    }
    
    if (!privateKey) {
      throw new Error(`Failed to import private key with any format. Last error: ${lastError.message}`);
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
console.log('- Private key first 20 chars:', privateKeyBase64.substring(0, 20));
console.log('- Private key last 20 chars:', privateKeyBase64.substring(privateKeyBase64.length - 20));
console.log('- Ciphertext length:', agentCiphertext.length);
console.log('- Encapsulated key length:', agentEncapsulatedKey.length);

// Try to decode and inspect the key
try {
  const keyBuffer = Buffer.from(privateKeyBase64, 'base64');
  console.log('- Decoded key buffer length:', keyBuffer.length);
  console.log('- Key buffer first 10 bytes:', Array.from(keyBuffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));
} catch (e) {
  console.log('- Failed to decode private key as base64:', e.message);
}

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
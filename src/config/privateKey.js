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
  // Initialize the cipher suite
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  // Convert base64 to ArrayBuffer using browser APIs
  const base64ToBuffer = (base64) =>
    Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;

  // Import private key using WebCrypto
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToBuffer(privateKeyBase64),
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"],
  );

  // Create recipient context and decrypt
  const recipient = await suite.createRecipientContext({
    recipientKey: privateKey,
    enc: base64ToBuffer(encapsulatedKeyBase64),
  });

  return new TextDecoder().decode(
    await recipient.open(base64ToBuffer(ciphertextBase64)),
  );
}

const privateKeyBase64 = process.env.SECRET_DECRYPTER_KEY;

const response = {
  encryption_type: "HPKE",
  ciphertext: process.env.AGENT_CIPHERTEXT,
  encapsulated_key: process.env.AGENT_ENCAPSULATED_KEY,
};

const privateKey = await decryptHPKEMessage(
  privateKeyBase64,
  response.encapsulated_key,
  response.ciphertext,
);
//   .then((decryptedMessage) => {
//     console.log("Decrypted message:", decryptedMessage);

//   })
//   .catch((error) => {
//     console.error("Error decrypting message:", error);
//   });

export const getPrivateKey = async () => {
  return privateKey;
};

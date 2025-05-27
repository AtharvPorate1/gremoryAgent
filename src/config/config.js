import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getPrivateKey } from "./privateKey.js";

export const RPC_URL =
  "https://spring-silent-asphalt.solana-mainnet.quiknode.pro/bb1893fb836e6afbdef2f66e511cb53fc38929a2";
export const connection = new Connection(RPC_URL, "confirmed");
export const USDC_USDT_POOL = new PublicKey(
  "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6",
);

// const privateKey = (await getPrivateKey()) || "";
const privateKey = (await getPrivateKey()) || "";
console.log("Private Key:", privateKey);
// export const user = Keypair.fromSecretKey(bs58.decode(privateKey));
export const user = Keypair.fromSecretKey(bs58.decode(privateKey));

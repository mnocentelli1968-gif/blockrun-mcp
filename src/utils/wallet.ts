// src/utils/wallet.ts
import { LLMClient, ImageClient } from "@blockrun/llm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import { WALLET_DIR, WALLET_FILE, USDC_ADDRESS, BASE_RPC_URLS } from "./constants.js";

let _walletWasCreated = false;
let _walletAddress: string | null = null;
let _client: LLMClient | null = null;
let _imageClient: ImageClient | null = null;

export function getOrCreateWalletKey(): `0x${string}` {
  const envKey = process.env.BLOCKRUN_WALLET_KEY || process.env.BASE_CHAIN_WALLET_KEY;
  if (envKey) {
    const account = privateKeyToAccount(envKey as `0x${string}`);
    _walletAddress = account.address;
    return envKey as `0x${string}`;
  }

  if (fs.existsSync(WALLET_FILE)) {
    try {
      const savedKey = fs.readFileSync(WALLET_FILE, "utf-8").trim();
      if (savedKey.startsWith("0x") && savedKey.length === 66) {
        const account = privateKeyToAccount(savedKey as `0x${string}`);
        _walletAddress = account.address;
        return savedKey as `0x${string}`;
      }
    } catch {}
  }

  const newKey = generatePrivateKey();
  const account = privateKeyToAccount(newKey);
  _walletAddress = account.address;
  _walletWasCreated = true;

  try {
    if (!fs.existsSync(WALLET_DIR)) {
      fs.mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(WALLET_FILE, newKey, { mode: 0o600 });
    console.error(`[BlockRun] New wallet created and saved to ${WALLET_FILE}`);
  } catch (err) {
    console.error(`[BlockRun] Warning: Could not save wallet to file: ${err}`);
  }

  return newKey;
}

export function getClient(): LLMClient {
  if (!_client) {
    const privateKey = getOrCreateWalletKey();
    _client = new LLMClient({ privateKey });
  }
  return _client;
}

export function getImageClient(): ImageClient {
  if (!_imageClient) {
    const privateKey = getOrCreateWalletKey();
    _imageClient = new ImageClient({ privateKey });
  }
  return _imageClient;
}

export function getWalletInfo() {
  const llm = getClient();
  const address = llm.getWalletAddress();
  return {
    address,
    network: "Base",
    chainId: 8453,
    currency: "USDC",
    isNew: _walletWasCreated,
    basescanUrl: `https://basescan.org/address/${address}`,
  };
}

export async function getUsdcBalance(address: string): Promise<number | null> {
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: USDC_ADDRESS,
        data: `0x70a08231000000000000000000000000${address.slice(2)}`,
      },
      "latest",
    ],
    id: 1,
  };

  for (const rpcUrl of BASE_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json() as { result?: string };
      if (result.result) {
        return parseInt(result.result, 16) / 1e6;
      }
    } catch {
      continue;
    }
  }
  return null;
}

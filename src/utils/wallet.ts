// src/utils/wallet.ts
// Use the SDK's wallet management directly — it handles scanning, fallback, and creation properly.
import {
  LLMClient,
  ImageClient,
  PriceClient,
  getOrCreateWallet,
  getPaymentLinks,
  formatWalletCreatedMessage,
  formatNeedsFundingMessage,
} from "@blockrun/llm";

let _client: LLMClient | null = null;
let _imageClient: ImageClient | null = null;
let _priceClient: PriceClient | null = null;
let _walletInfo: { address: string; privateKey: string; isNew: boolean } | null = null;

function ensureWallet() {
  if (!_walletInfo) {
    // SDK handles: env var → scan ~/.<provider>/wallet.json → .session → wallet.key → create new
    _walletInfo = getOrCreateWallet();
    if (_walletInfo.isNew) {
      console.error(formatWalletCreatedMessage(_walletInfo.address));
    }
  }
  return _walletInfo;
}

export function getOrCreateWalletKey(): `0x${string}` {
  const info = ensureWallet();
  return info.privateKey as `0x${string}`;
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

export function getPriceClient(): PriceClient {
  if (!_priceClient) {
    const privateKey = getOrCreateWalletKey();
    _priceClient = new PriceClient({ privateKey });
  }
  return _priceClient;
}

export function getWalletInfo() {
  const info = ensureWallet();
  const links = getPaymentLinks(info.address);
  return {
    address: info.address,
    network: "Base",
    chainId: 8453,
    currency: "USDC",
    isNew: info.isNew,
    basescanUrl: links.basescan,
    fundingUrl: links.blockrun,
  };
}

export { formatNeedsFundingMessage };

export async function getUsdcBalance(address: string): Promise<number | null> {
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const BASE_RPC_URLS = [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://1rpc.io/base",
  ];
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: USDC_ADDRESS, data: `0x70a08231000000000000000000000000${address.slice(2)}` }, "latest"],
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
      if (result.result) return parseInt(result.result, 16) / 1e6;
    } catch { continue; }
  }
  return null;
}

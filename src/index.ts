#!/usr/bin/env node
/**
 * BlockRun MCP Server v0.4.1
 *
 * Access 30+ AI models (GPT-5, Claude, Gemini, etc.) via x402 micropayments.
 * No API keys needed - just a wallet with USDC on Base.
 *
 * Installation:
 *   claude mcp add blockrun npx @blockrun/mcp
 *
 * Or with explicit wallet:
 *   claude mcp add blockrun npx @blockrun/mcp --env BLOCKRUN_WALLET_KEY=0x...
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { LLMClient, ImageClient, type Model } from "@blockrun/llm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import QRCode from "qrcode";
import { Jimp } from "jimp";
import open from "open";

// Wallet file location (matches Python SDK)
const WALLET_DIR = path.join(os.homedir(), ".blockrun");
const WALLET_FILE = path.join(WALLET_DIR, ".session");
const QR_FILE = path.join(WALLET_DIR, "qr.png");

// USDC on Base
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = "8453";

// Model categories for smart routing
const MODEL_TIERS = {
  fast: ["google/gemini-2.5-flash", "openai/gpt-4o-mini", "deepseek/deepseek-chat", "xai/grok-4-1-fast-non-reasoning"],
  balanced: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro", "xai/grok-4-1-fast-reasoning"],
  powerful: ["openai/gpt-5.2", "anthropic/claude-opus-4.5", "anthropic/claude-opus-4", "openai/o3"],
  cheap: ["nvidia/gpt-oss-120b", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "openai/gpt-4o-mini"],
  reasoning: ["openai/o3", "openai/o1", "openai/o4-mini", "deepseek/deepseek-reasoner", "xai/grok-4-1-fast-reasoning"],
} as const;

type RoutingMode = keyof typeof MODEL_TIERS;

// Track if wallet was newly created
let walletWasCreated = false;
let walletAddress: string | null = null;

// Initialize clients with auto wallet management
let client: LLMClient | null = null;
let imageClient: ImageClient | null = null;
let cachedModels: Model[] | null = null;

// Session budget tracking
interface BudgetState {
  limit: number | null;
  spent: number;
  calls: number;
}
let sessionBudget: BudgetState = { limit: null, spent: 0, calls: 0 };

// RPC endpoints for balance check
const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

// ============================================================================
// WALLET MANAGEMENT
// ============================================================================

function getOrCreateWalletKey(): `0x${string}` {
  const envKey = process.env.BLOCKRUN_WALLET_KEY || process.env.BASE_CHAIN_WALLET_KEY;
  if (envKey) {
    const account = privateKeyToAccount(envKey as `0x${string}`);
    walletAddress = account.address;
    return envKey as `0x${string}`;
  }

  if (fs.existsSync(WALLET_FILE)) {
    try {
      const savedKey = fs.readFileSync(WALLET_FILE, "utf-8").trim();
      if (savedKey.startsWith("0x") && savedKey.length === 66) {
        const account = privateKeyToAccount(savedKey as `0x${string}`);
        walletAddress = account.address;
        return savedKey as `0x${string}`;
      }
    } catch {}
  }

  const newKey = generatePrivateKey();
  const account = privateKeyToAccount(newKey);
  walletAddress = account.address;
  walletWasCreated = true;

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

function getClient(): LLMClient {
  if (!client) {
    const privateKey = getOrCreateWalletKey();
    client = new LLMClient({ privateKey });
  }
  return client;
}

function getImageClient(): ImageClient {
  if (!imageClient) {
    const privateKey = getOrCreateWalletKey();
    imageClient = new ImageClient({ privateKey });
  }
  return imageClient;
}

function getWalletInfo() {
  const llm = getClient();
  const address = llm.getWalletAddress();
  return {
    address,
    network: "Base",
    chainId: 8453,
    currency: "USDC",
    isNew: walletWasCreated,
    basescanUrl: `https://basescan.org/address/${address}`,
  };
}

async function getUsdcBalance(address: string): Promise<number | null> {
  const data = {
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{
      to: USDC_ADDRESS,
      data: `0x70a08231000000000000000000000000${address.slice(2)}`,
    }, "latest"],
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

// ============================================================================
// QR CODE GENERATION
// ============================================================================

function getEip681Uri(address: string, amountUsdc: number = 1.0): string {
  const amountWei = Math.floor(amountUsdc * 1_000_000);
  return `ethereum:${USDC_ADDRESS}@${BASE_CHAIN_ID}/transfer?address=${address}&uint256=${amountWei}`;
}

async function generateQrPng(address: string): Promise<string> {
  const eip681Uri = getEip681Uri(address);

  // Generate QR code buffer
  const qrBuffer = await QRCode.toBuffer(eip681Uri, {
    type: "png",
    width: 400,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  // Load QR code with Jimp
  const qrImage = await Jimp.read(qrBuffer);

  // Try to add Base logo in center
  try {
    const logoUrl = "https://avatars.githubusercontent.com/u/108554348?s=200&v=4";
    const logo = await Jimp.read(logoUrl);
    const logoSize = Math.floor(qrImage.width * 0.2);
    logo.resize({ w: logoSize, h: logoSize });

    const x = Math.floor((qrImage.width - logoSize) / 2);
    const y = Math.floor((qrImage.height - logoSize) / 2);
    qrImage.composite(logo, x, y);
  } catch {
    // Continue without logo if fetch fails
  }

  // Ensure directory exists
  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true, mode: 0o700 });
  }

  // Save QR code
  await qrImage.write(QR_FILE as `${string}.${string}`);
  return QR_FILE;
}

async function openQrInViewer(qrPath: string): Promise<void> {
  try {
    await open(qrPath);
  } catch {
    // Silently fail if can't open
  }
}

// ============================================================================
// BUDGET MANAGEMENT
// ============================================================================

function recordSpending(cost: number): void {
  sessionBudget.spent += cost;
  sessionBudget.calls += 1;
}

function checkBudget(): { allowed: boolean; remaining: number | null } {
  if (sessionBudget.limit === null) {
    return { allowed: true, remaining: null };
  }
  const remaining = sessionBudget.limit - sessionBudget.spent;
  return { allowed: remaining > 0, remaining };
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function formatError(message: string): string {
  const msgLower = message.toLowerCase();

  // Check for specific error types
  const isPaymentError = msgLower.includes("402") ||
    msgLower.includes("balance") ||
    msgLower.includes("insufficient") ||
    (msgLower.includes("payment") && !msgLower.includes("500"));

  const isServerError = msgLower.includes("500") ||
    msgLower.includes("api error after payment");

  let errorText = `Error: ${message}`;

  if (isServerError) {
    // 500 errors after payment = upstream API issue, not wallet issue
    errorText += `\n\nThis is a temporary API issue. The xAI/Grok API may be experiencing problems.` +
      `\nTry again in a few minutes, or use a different model (e.g., openai/gpt-4o).`;
  } else if (isPaymentError) {
    errorText += `\n\nThis error usually means your wallet needs funding.\n` +
      `Run blockrun_wallet with action: "setup" to get funding instructions.\n\n` +
      `Quick fix: Send USDC to your wallet on Base network.`;
  }

  return errorText;
}

// ============================================================================
// SERVER SETUP
// ============================================================================

const server = new McpServer({
  name: "blockrun-mcp",
  version: "0.4.0",
});

// ============================================================================
// TOOL 1: blockrun_wallet (consolidated)
// ============================================================================

server.registerTool(
  "blockrun_wallet",
  {
    description: `Manage your BlockRun wallet - check status, get funding instructions, open QR code, or manage session budget.

Actions:
- status: Show wallet address, balance, and basescan link (default)
- setup: Full funding instructions with QR code
- qr: Generate and open QR code for easy funding
- budget: Manage session spending limit

Examples:
  blockrun_wallet()                                    -> status + balance
  blockrun_wallet({ action: "setup" })                 -> funding instructions + QR
  blockrun_wallet({ action: "qr" })                    -> open QR code
  blockrun_wallet({ action: "budget", budget_action: "set", budget_amount: 1.00 })`,
    inputSchema: {
      action: z.enum(["status", "setup", "qr", "budget"]).optional().default("status").describe("What to do"),
      budget_action: z.enum(["set", "check", "clear"]).optional().describe("Budget action (for action='budget')"),
      budget_amount: z.number().optional().describe("Budget limit in USD (for budget_action='set')"),
    },
  },
  async ({ action, budget_action, budget_amount }) => {
    const info = getWalletInfo();
    const address = info.address;

    // Handle budget action
    if (action === "budget") {
      const budgetAct = budget_action || "check";

      if (budgetAct === "set") {
        if (budget_amount === undefined || budget_amount <= 0) {
          return {
            content: [{ type: "text", text: "Error: Provide a positive budget_amount (e.g., 1.00 for $1.00)" }],
            isError: true,
          };
        }
        sessionBudget.limit = budget_amount;
      } else if (budgetAct === "clear") {
        sessionBudget.limit = null;
      }

      const remaining = sessionBudget.limit !== null ? sessionBudget.limit - sessionBudget.spent : null;
      const limitStr = sessionBudget.limit !== null ? `$${sessionBudget.limit.toFixed(2)}` : "Unlimited";
      const remainingStr = remaining !== null ? `$${remaining.toFixed(4)}` : "N/A";

      return {
        content: [{ type: "text", text: `Session Budget: ${limitStr} | Spent: $${sessionBudget.spent.toFixed(4)} | Calls: ${sessionBudget.calls} | Remaining: ${remainingStr}${budgetAct === "set" ? ` | Set to $${budget_amount?.toFixed(2)}` : ""}${budgetAct === "clear" ? " | Limit removed" : ""}` }],
        structuredContent: {
          limit: sessionBudget.limit,
          spent: sessionBudget.spent,
          calls: sessionBudget.calls,
          remaining,
        },
      };
    }

    // Handle QR action
    if (action === "qr") {
      try {
        const qrPath = await generateQrPng(address);
        await openQrInViewer(qrPath);
        return {
          content: [{ type: "text", text: `QR code opened! Scan with MetaMask to send USDC on Base.\n\nAddress: ${address}\nQR saved: ${qrPath}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Failed to generate QR: ${err}` }],
          isError: true,
        };
      }
    }

    // Handle setup action
    if (action === "setup") {
      // Generate and open QR
      let qrMessage = "";
      try {
        const qrPath = await generateQrPng(address);
        await openQrInViewer(qrPath);
        qrMessage = `\nQR code opened for scanning! (${qrPath})`;
      } catch {
        qrMessage = "\n(QR generation failed - use address above)";
      }

      const text = `
================================================================================
                        BLOCKRUN WALLET SETUP
================================================================================

Your wallet address: ${address}
${qrMessage}

HOW TO FUND YOUR WALLET:
------------------------

Option 1: Transfer from Coinbase
  1. Open Coinbase app or website
  2. Go to Send/Receive -> Select USDC
  3. Choose "Base" network (important!)
  4. Paste: ${address}
  5. Send $1-5 to start

Option 2: Bridge from other chains
  https://bridge.base.org -> Bridge USDC to Base -> Send to address above

Option 3: Buy directly
  https://www.coinbase.com/onramp -> Buy USDC on Base -> Send to address above

VERIFY BALANCE: https://basescan.org/address/${address}

PRICING (pay per use):
  - GPT-4o: ~$0.005/request | Claude Sonnet: ~$0.003/request
  - Gemini Flash: ~$0.0001/request | Full pricing: https://blockrun.ai/pricing

SECURITY: Private key stored at ~/.blockrun/.session (never leaves your machine)
================================================================================`;

      return { content: [{ type: "text", text }] };
    }

    // Default: status action
    const balance = await getUsdcBalance(address);
    const balanceStr = balance !== null ? `$${balance.toFixed(6)} USDC` : "Unable to fetch";
    const lowBalance = balance !== null && balance < 1;

    const text = `Wallet: ${address}
Balance: ${balanceStr}${lowBalance ? " (low - add funds)" : ""}
Network: Base | View: ${info.basescanUrl}
${info.isNew ? "\nNEW WALLET - Run with action: 'setup' for funding instructions" : ""}`;

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        address: info.address,
        balance,
        network: info.network,
        chainId: info.chainId,
        isNew: info.isNew,
        basescanUrl: info.basescanUrl,
      },
    };
  }
);

// ============================================================================
// TOOL 2: blockrun_chat (consolidated)
// ============================================================================

server.registerTool(
  "blockrun_chat",
  {
    description: `Chat with AI models via BlockRun. Supports 30+ models with pay-per-request micropayments.

Two ways to use:
1. Specify a model directly: model: "openai/gpt-4o"
2. Use smart routing: mode: "fast" | "balanced" | "powerful" | "cheap" | "reasoning"

Popular models:
- openai/gpt-5.2, openai/gpt-4o, openai/gpt-4o-mini
- anthropic/claude-opus-4, anthropic/claude-sonnet-4
- google/gemini-2.5-pro, google/gemini-2.5-flash
- deepseek/deepseek-chat (very affordable)

Smart routing modes:
- fast: Gemini Flash, GPT-4o-mini (quickest)
- balanced: GPT-4o, Claude Sonnet (good default)
- powerful: GPT-5.2, Claude Opus 4 (best quality)
- cheap: DeepSeek, Gemini Flash (lowest cost)
- reasoning: o3, o1 (complex logic)

Use blockrun_models to see all available models with pricing.`,
    inputSchema: {
      message: z.string().describe("Your message to the AI"),
      model: z.string().optional().describe("Specific model ID (e.g., 'openai/gpt-4o')"),
      mode: z.enum(["fast", "balanced", "powerful", "cheap", "reasoning"]).optional().describe("Smart routing mode (ignored if model specified)"),
      system: z.string().optional().describe("Optional system prompt"),
      max_tokens: z.number().optional().default(1024).describe("Max tokens in response"),
      temperature: z.number().optional().default(1).describe("Creativity 0-2"),
    },
  },
  async ({ message, model, mode, system, max_tokens, temperature }) => {
    const llm = getClient();

    // If specific model provided, use it directly
    if (model) {
      try {
        const response = await llm.chat(model, message, {
          system,
          maxTokens: max_tokens,
          temperature,
        });
        return { content: [{ type: "text", text: response }] };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: formatError(errorMessage) }],
          isError: true,
        };
      }
    }

    // Smart routing mode
    const routingMode: RoutingMode = mode || "balanced";
    const models = MODEL_TIERS[routingMode];

    let lastError: Error | null = null;
    for (const m of models) {
      try {
        const response = await llm.chat(m, message, {
          system,
          maxTokens: max_tokens,
        });
        return {
          content: [{ type: "text", text: `[${m}]\n\n${response}` }],
          structuredContent: { model_used: m, response },
        };
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    const errorMessage = lastError?.message || "All models failed";
    return {
      content: [{ type: "text", text: formatError(errorMessage) }],
      isError: true,
    };
  }
);

// ============================================================================
// TOOL 3: blockrun_models (unchanged)
// ============================================================================

server.registerTool(
  "blockrun_models",
  {
    description: "List available AI models with pricing. Use to discover models and compare costs.",
    inputSchema: {
      category: z.enum(["all", "chat", "reasoning", "image", "embedding"]).optional().default("all").describe("Filter by category"),
      provider: z.string().optional().describe("Filter by provider (e.g., 'openai', 'anthropic')"),
    },
  },
  async ({ category, provider }) => {
    const llm = getClient();

    if (!cachedModels) {
      cachedModels = await llm.listModels();
      setTimeout(() => { cachedModels = null; }, 5 * 60 * 1000);
    }

    let models = cachedModels;

    if (provider) {
      const p = provider.toLowerCase();
      models = models.filter(m => m.id.toLowerCase().startsWith(p + "/"));
    }

    if (category && category !== "all") {
      if (category === "image") {
        models = models.filter(m => m.id.includes("dall-e") || m.id.includes("flux") || m.id.includes("banana"));
      } else if (category === "reasoning") {
        models = models.filter(m => m.id.includes("/o1") || m.id.includes("/o3") || m.id.includes("reasoner"));
      } else if (category === "embedding") {
        models = models.filter(m => m.id.includes("embed"));
      }
    }

    const lines = models.map(m => {
      const input = m.inputPrice ? `$${m.inputPrice}/M in` : "";
      const output = m.outputPrice ? `$${m.outputPrice}/M out` : "";
      const pricing = [input, output].filter(Boolean).join(", ");
      return `- ${m.id}${pricing ? ` (${pricing})` : ""}`;
    });

    return {
      content: [{ type: "text", text: `Models (${models.length}):\n${lines.join("\n")}` }],
      structuredContent: { count: models.length, models },
    };
  }
);

// ============================================================================
// TOOL 4: blockrun_image (uses ImageClient for x402 payments)
// ============================================================================

server.registerTool(
  "blockrun_image",
  {
    description: `Generate images. Models: openai/dall-e-3 ($0.04-0.08), together/flux-schnell ($0.02), google/nano-banana`,
    inputSchema: {
      prompt: z.string().describe("Image description"),
      model: z.enum(["openai/dall-e-3", "together/flux-schnell", "google/nano-banana"]).optional().default("openai/dall-e-3"),
      size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
      quality: z.enum(["standard", "hd"]).optional().default("standard"),
    },
  },
  async ({ prompt, model, size, quality }) => {
    try {
      const imgClient = getImageClient();
      const response = await imgClient.generate(prompt, {
        model: model as "openai/dall-e-3" | "together/flux-schnell" | "google/nano-banana",
        size: size as "1024x1024" | "1792x1024" | "1024x1792",
        quality: quality as "standard" | "hd",
      });

      const imageUrl = response.data?.[0]?.url;

      if (!imageUrl) {
        return {
          content: [{ type: "text", text: formatError("No image URL in response") }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Image: ${imageUrl}\nPrompt: ${prompt}\nModel: ${model}` }],
        structuredContent: { url: imageUrl, prompt, model: model! },
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("balance") || errMsg.includes("payment") || errMsg.includes("402")) {
        return {
          content: [{ type: "text", text: `Image generation requires payment. Run blockrun_wallet with action: "setup" for funding instructions.\nError: ${errMsg}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: formatError(`Image generation failed: ${errMsg}`) }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// TOOL 5: blockrun_twitter (unchanged)
// ============================================================================

server.registerTool(
  "blockrun_twitter",
  {
    description: `Search real-time X/Twitter via Grok. Use for trending topics, @handles, breaking news.`,
    inputSchema: {
      query: z.string().describe("Search query (can include @handles, topics)"),
      max_results: z.number().optional().default(10).describe("Max results (1-25)"),
    },
  },
  async ({ query, max_results }) => {
    const budget = checkBudget();
    if (!budget.allowed) {
      return {
        content: [{ type: "text", text: `Budget limit reached ($${sessionBudget.spent.toFixed(4)} of $${sessionBudget.limit?.toFixed(2)}). Use blockrun_wallet with action: "budget" to adjust.` }],
        isError: true,
      };
    }

    try {
      const llm = getClient();
      const response = await llm.chat("xai/grok-3", query, {
        system: `Real-time X/Twitter search. Focus on recent posts, key accounts, engagement. Max results: ${max_results}`,
        search: true,
      } as Parameters<typeof llm.chat>[2] & { search?: boolean });

      recordSpending(0.002);

      return {
        content: [{ type: "text", text: `[X/Twitter via Grok]\n\n${response}` }],
        structuredContent: { query, model: "xai/grok-3", response },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: formatError(errorMessage) }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// TOOL 6: blockrun_dex (DexScreener API - free, no auth)
// ============================================================================

server.registerTool(
  "blockrun_dex",
  {
    description: `Get real-time DEX data from DexScreener. FREE - no payment required.

Use for:
- Token prices and liquidity across chains
- Trading volume and price changes
- Finding token pairs and contracts

Examples:
  blockrun_dex({ query: "SOL" })           -> Search for SOL pairs
  blockrun_dex({ token: "So11...xxx" })    -> Get specific token data
  blockrun_dex({ symbol: "PEPE" })         -> Search by symbol`,
    inputSchema: {
      query: z.string().optional().describe("Search query (token name, symbol, or address)"),
      token: z.string().optional().describe("Token address for direct lookup"),
      symbol: z.string().optional().describe("Token symbol to search"),
      chain: z.string().optional().describe("Filter by chain (ethereum, solana, base, etc.)"),
    },
  },
  async ({ query, token, symbol, chain }) => {
    try {
      let url: string;
      let searchTerm = query || symbol || "";

      if (token) {
        url = `https://api.dexscreener.com/latest/dex/tokens/${token}`;
      } else if (searchTerm) {
        url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchTerm)}`;
      } else {
        return {
          content: [{ type: "text", text: "Provide query, token address, or symbol" }],
          isError: true,
        };
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data = await response.json() as {
        pairs?: Array<{
          chainId: string;
          dexId: string;
          pairAddress: string;
          baseToken: { address: string; name: string; symbol: string };
          quoteToken: { symbol: string };
          priceUsd: string;
          priceNative: string;
          volume: { h24: number };
          priceChange: { h24: number };
          liquidity: { usd: number };
          fdv: number;
          txns: { h24: { buys: number; sells: number } };
        }>;
      };

      let pairs = data.pairs || [];

      // Filter by chain if specified
      if (chain && pairs.length > 0) {
        const chainLower = chain.toLowerCase();
        pairs = pairs.filter(p => p.chainId.toLowerCase().includes(chainLower));
      }

      // Take top 10 pairs by volume
      pairs = pairs
        .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
        .slice(0, 10);

      if (pairs.length === 0) {
        return {
          content: [{ type: "text", text: `No pairs found for: ${searchTerm || token}` }],
        };
      }

      // Format results
      const lines = pairs.map(p => {
        const price = p.priceUsd ? `$${parseFloat(p.priceUsd).toFixed(6)}` : "N/A";
        const change = p.priceChange?.h24 ? `${p.priceChange.h24 > 0 ? "+" : ""}${p.priceChange.h24.toFixed(2)}%` : "";
        const vol = p.volume?.h24 ? `$${(p.volume.h24 / 1000000).toFixed(2)}M` : "";
        const liq = p.liquidity?.usd ? `$${(p.liquidity.usd / 1000000).toFixed(2)}M liq` : "";
        const buySell = p.txns?.h24 ? `${p.txns.h24.buys}B/${p.txns.h24.sells}S` : "";

        return `${p.baseToken.symbol}/${p.quoteToken.symbol} (${p.chainId}/${p.dexId})
  Price: ${price} ${change} | Vol: ${vol} | ${liq} | Txns: ${buySell}
  Token: ${p.baseToken.address}`;
      });

      return {
        content: [{ type: "text", text: `[DexScreener - FREE]\n\n${lines.join("\n\n")}` }],
        structuredContent: { pairs, count: pairs.length },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `DexScreener error: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// TOOL 7: blockrun_whale (BigQuery on-demand - whale tracking)
// ============================================================================

const WHALE_THRESHOLD_ETH = 100; // 100+ ETH transfers
const WHALE_THRESHOLD_USD = 100000; // $100k+ transfers

// Known address labels (basic set - can expand)
const KNOWN_LABELS: Record<string, string> = {
  "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance 15",
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Binance 16",
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": "Binance 17",
  "0x9696f59e4d72e237be84ffd425dcad154bf96976": "Binance 18",
  "0x4976a4a02f38326660d17bf34b431dc6e2eb2327": "Binance 19",
  "0xf977814e90da44bfa03b6295a0616a897441acec": "Binance 8",
  "0x5a52e96bacdabb82fd05763e25335261b270efcb": "Binance",
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be": "Binance",
  "0xd24400ae8bfebb18ca49be86258a3c749cf46853": "Gemini 2",
  "0x6fc82a5fe25a5cdb58bc74600a40a69c065263f8": "Gemini 3",
  "0x61edcdf5bb737adffe5043706e7c5bb1f1a56eea": "Gemini 4",
  "0x07ee55aa48bb72dcc6e9d78256648910de513eca": "Gemini 5",
  "0xdc76cd25977e0a5ae17155770273ad58648900d3": "Coinbase Prime",
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": "Coinbase 10",
  "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase 2",
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740": "Coinbase 3",
  "0x3cd751e6b0078be393132286c442345e5dc49699": "Coinbase 4",
  "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511": "Coinbase 5",
  "0xeb2629a2734e272bcc07bda959863f316f4bd4cf": "Coinbase 6",
  "0x02466e547bfdab679fc49e96bbfc62b9747d997c": "Coinbase 8",
  "0xa090e606e30bd747d4e6245a1517ebe430f0057e": "Coinbase",
  "0x8103683202aa8da10536036edef04cdd865c225e": "Kraken 13",
  "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b": "OKX 1",
  "0x236f9f97e0e62388479bf9e5ba4889e46b0273c3": "OKX 2",
  "0x5041ed759dd4afc3a72b8192c143f72f4724081a": "OKX 4",
  "0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88": "MEXC",
  "0x0d0707963952f2fba59dd06f2b425ace40b492fe": "Gate.io",
  "0x1c4b70a3968436b9a0a9cf5205c787eb81bb558c": "Gate.io 3",
  "0xd793281182a0e3e023116004778f45c29fc14f19": "Gate.io 4",
  "0x974caa59e49682cda0ad2bbe82983419a2ecc400": "HTX",
  "0x0211f3cedbef3143223d3acf0e589747933e8527": "HTX 2",
  "0x1062a747393198f70f71ec65a582423dba7e5ab3": "Bybit",
  "0xee5b5b923ffce93a870b3104b7ca09c3db80047a": "Bybit 2",
  "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503": "Binance: Foundation",
  "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8": "Binance 7",
  "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf": "Polygon Bridge",
  "0xa3a7b6f88361f48403514059f1f16c8e78d60eec": "Arbitrum Bridge",
  "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1": "Optimism Bridge",
  "0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a": "Arbitrum: Delayed Inbox",
  "0x0000000000000000000000000000000000000000": "Null/Burn Address",
};

function getAddressLabel(address: string): string {
  const lower = address.toLowerCase();
  return KNOWN_LABELS[lower] || shortenAddress(address);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

server.registerTool(
  "blockrun_whale",
  {
    description: `Track large ETH transfers (whale movements). Uses BigQuery public data.

Shows:
- Large transfers (100+ ETH)
- Exchange inflows/outflows
- Labels for known addresses (Binance, Coinbase, etc.)

Note: Requires GOOGLE_APPLICATION_CREDENTIALS env var for BigQuery auth.
For MVP/demo: Returns simulated data if BigQuery not configured.`,
    inputSchema: {
      hours: z.number().optional().default(24).describe("Hours to look back (default: 24)"),
      min_eth: z.number().optional().default(100).describe("Minimum ETH amount (default: 100)"),
      limit: z.number().optional().default(20).describe("Max results (default: 20)"),
    },
  },
  async ({ hours, min_eth, limit }) => {
    // Check if BigQuery is configured
    const hasGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT;

    if (!hasGoogleCreds) {
      // Return demo data for showcase
      const demoData = [
        { from: "0xf977814e90da44bfa03b6295a0616a897441acec", to: "0x28c6c06298d514db089934071355e5743bf21d60", value: 5000, time: "2h ago" },
        { from: "0x503828976d22510aad0201ac7ec88293211d23da", to: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503", value: 3200, time: "4h ago" },
        { from: "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", to: "0xd24400ae8bfebb18ca49be86258a3c749cf46853", value: 2100, time: "6h ago" },
        { from: "0x1062a747393198f70f71ec65a582423dba7e5ab3", to: "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1", value: 1800, time: "8h ago" },
        { from: "0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88", to: "0xa3a7b6f88361f48403514059f1f16c8e78d60eec", value: 1500, time: "12h ago" },
      ];

      const lines = demoData.map(t => {
        const fromLabel = getAddressLabel(t.from);
        const toLabel = getAddressLabel(t.to);
        return `${t.value.toLocaleString()} ETH | ${fromLabel} → ${toLabel} | ${t.time}`;
      });

      return {
        content: [{
          type: "text",
          text: `[Whale Tracker - DEMO MODE]
⚠️ BigQuery not configured. Showing sample data.

To enable real data:
1. Create GCP project: console.cloud.google.com
2. Enable BigQuery API
3. Set GOOGLE_APPLICATION_CREDENTIALS env var

Sample whale movements:
${lines.join("\n")}

Total: ${demoData.reduce((s, t) => s + t.value, 0).toLocaleString()} ETH across ${demoData.length} transfers`,
        }],
        structuredContent: { demo: true, transfers: demoData },
      };
    }

    // Real BigQuery integration would go here
    // For now, return instructions
    return {
      content: [{
        type: "text",
        text: `[Whale Tracker]

BigQuery credentials detected. Real-time query:
- Looking back: ${hours}h
- Min transfer: ${min_eth} ETH
- Limit: ${limit} results

Query would run:
SELECT block_timestamp, from_address, to_address, value/1e18 as eth
FROM \`bigquery-public-data.crypto_ethereum.transactions\`
WHERE value > ${min_eth} * 1e18
  AND block_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${hours} HOUR)
ORDER BY value DESC
LIMIT ${limit}

Note: Full BigQuery integration coming soon.`,
      }],
    };
  }
);

// ============================================================================
// TOOL 8: blockrun_analyze (combine sources for trading decisions)
// ============================================================================

server.registerTool(
  "blockrun_analyze",
  {
    description: `Comprehensive trading analysis combining multiple data sources.

Analyzes:
- DEX data (price, volume, liquidity) via DexScreener
- Twitter/X sentiment via Grok
- Whale movements (if BigQuery configured)
- AI synthesis of all data

Example: blockrun_analyze({ token: "SOL", question: "Should I buy?" })`,
    inputSchema: {
      token: z.string().describe("Token symbol or address to analyze"),
      question: z.string().optional().describe("Specific question (default: general analysis)"),
      include_twitter: z.boolean().optional().default(true).describe("Include Twitter sentiment"),
      include_whale: z.boolean().optional().default(false).describe("Include whale tracking"),
    },
  },
  async ({ token, question, include_twitter, include_whale }) => {
    const llm = getClient();
    const analysisPrompt = question || `Provide comprehensive trading analysis for ${token}`;
    let contextData = "";

    // 1. Get DEX data
    try {
      const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token)}`;
      const dexResponse = await fetch(dexUrl);
      const dexData = await dexResponse.json() as {
        pairs?: Array<{
          chainId: string;
          baseToken: { symbol: string; name: string };
          priceUsd: string;
          priceChange: { h24: number; h6: number; h1: number };
          volume: { h24: number };
          liquidity: { usd: number };
          fdv: number;
        }>;
      };

      if (dexData.pairs && dexData.pairs.length > 0) {
        const topPair = dexData.pairs[0];
        contextData += `\n## DEX Data (DexScreener)\n`;
        contextData += `- Token: ${topPair.baseToken.name} (${topPair.baseToken.symbol})\n`;
        contextData += `- Price: $${parseFloat(topPair.priceUsd).toFixed(6)}\n`;
        contextData += `- 24h Change: ${topPair.priceChange?.h24?.toFixed(2) || "N/A"}%\n`;
        contextData += `- 24h Volume: $${((topPair.volume?.h24 || 0) / 1000000).toFixed(2)}M\n`;
        contextData += `- Liquidity: $${((topPair.liquidity?.usd || 0) / 1000000).toFixed(2)}M\n`;
        contextData += `- FDV: $${((topPair.fdv || 0) / 1000000000).toFixed(2)}B\n`;
        contextData += `- Chain: ${topPair.chainId}\n`;
      }
    } catch (err) {
      contextData += `\n## DEX Data: Error fetching\n`;
    }

    // 2. Get Twitter sentiment (if requested)
    if (include_twitter) {
      try {
        const twitterResponse = await llm.chat("xai/grok-3", `What are people saying about ${token} on Twitter/X right now? Focus on: sentiment, key influencers, trending topics, price predictions.`, {
          system: "Real-time X/Twitter search. Provide factual summary of recent posts.",
          search: true,
        } as Parameters<typeof llm.chat>[2] & { search?: boolean });
        contextData += `\n## Twitter/X Sentiment (via Grok)\n${twitterResponse}\n`;
      } catch {
        contextData += `\n## Twitter: Unable to fetch\n`;
      }
    }

    // 3. Whale movements (demo data if not configured)
    if (include_whale) {
      contextData += `\n## Whale Movements\n`;
      contextData += `Note: BigQuery not configured. In production, this would show:\n`;
      contextData += `- Large transfers to/from exchanges\n`;
      contextData += `- Smart money wallet movements\n`;
      contextData += `- Exchange inflow/outflow trends\n`;
    }

    // 4. AI Synthesis
    const synthesisPrompt = `You are a crypto trading analyst. Based on the following data, answer: "${analysisPrompt}"

${contextData}

Provide:
1. Key findings (bullet points)
2. Risk assessment (Low/Medium/High)
3. Trading suggestion (if asked)
4. What to watch for

Be factual and balanced. Don't give financial advice, but provide analysis based on the data.`;

    try {
      const analysis = await llm.chat("openai/gpt-4o", synthesisPrompt, {
        system: "Expert crypto trading analyst. Provide data-driven analysis.",
        maxTokens: 1500,
      });

      return {
        content: [{
          type: "text",
          text: `[BlockRun Trading Analysis: ${token}]\n\n${analysis}\n\n---\nData sources: DexScreener${include_twitter ? ", Twitter/X (Grok)" : ""}${include_whale ? ", Whale Tracker" : ""}`,
        }],
        structuredContent: { token, question: analysisPrompt, analysis },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: formatError(errorMessage) }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// TOOL 9: blockrun_signal (RSI + MACD + EMA trading signals)
// ============================================================================

// Technical indicator calculations
function calculateEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine.slice(-9), 9);

  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd, signal, histogram: macd - signal };
}

server.registerTool(
  "blockrun_signal",
  {
    description: `Generate trading signals using RSI + MACD + EMA strategy.

Strategy (from freqtrade-strategies):
- BUY when: RSI < 40 (oversold) + MACD > Signal + Price > EMA200
- SELL when: RSI > 70 (overbought) or take profit/stop loss

Returns: BUY / SELL / HOLD signal with confidence level.

Example: blockrun_signal({ symbol: "BTCUSDT" })`,
    inputSchema: {
      symbol: z.string().describe("Trading pair (e.g., BTCUSDT, ETHUSDT, SOLUSDT)"),
      timeframe: z.enum(["5m", "15m", "1h", "4h"]).optional().default("1h").describe("Candle timeframe"),
    },
  },
  async ({ symbol, timeframe }) => {
    try {
      // Fetch candles from Binance public API (no auth needed)
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${timeframe}&limit=250`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const candles = await response.json() as Array<[number, string, string, string, string, string]>;
      const closes = candles.map(c => parseFloat(c[4])); // Close prices
      const currentPrice = closes[closes.length - 1];

      // Calculate indicators
      const rsi = calculateRSI(closes);
      const { macd, signal, histogram } = calculateMACD(closes);
      const ema200 = calculateEMA(closes, 200);
      const currentEMA200 = ema200[ema200.length - 1];
      const ema50 = calculateEMA(closes, 50);
      const currentEMA50 = ema50[ema50.length - 1];

      // Generate signal based on strategy
      let signalType: "BUY" | "SELL" | "HOLD" = "HOLD";
      let confidence = 0;
      let reasons: string[] = [];

      // BUY conditions
      const rsiOversold = rsi < 40;
      const macdBullish = macd > signal;
      const aboveEMA200 = currentPrice > currentEMA200;
      const aboveEMA50 = currentPrice > currentEMA50;

      // SELL conditions
      const rsiOverbought = rsi > 70;
      const macdBearish = macd < signal;
      const belowEMA200 = currentPrice < currentEMA200;

      if (rsiOversold && macdBullish && aboveEMA200) {
        signalType = "BUY";
        confidence = 80;
        reasons.push("RSI oversold (<40)");
        reasons.push("MACD bullish crossover");
        reasons.push("Price above EMA200 (uptrend)");
        if (aboveEMA50) {
          confidence += 10;
          reasons.push("Price above EMA50 (strong)");
        }
      } else if (rsiOverbought || (macdBearish && belowEMA200)) {
        signalType = "SELL";
        confidence = rsiOverbought ? 75 : 60;
        if (rsiOverbought) reasons.push("RSI overbought (>70)");
        if (macdBearish) reasons.push("MACD bearish");
        if (belowEMA200) reasons.push("Price below EMA200 (downtrend)");
      } else {
        signalType = "HOLD";
        confidence = 50;
        reasons.push("No clear signal");
        if (rsi < 50 && macdBullish) reasons.push("Slight bullish bias");
        if (rsi > 50 && macdBearish) reasons.push("Slight bearish bias");
      }

      // Calculate suggested stop loss and take profit
      const stopLoss = signalType === "BUY" ? currentPrice * 0.9 : null;
      const takeProfit = signalType === "BUY" ? currentPrice * 1.2 : null;

      const result = `[Trading Signal: ${symbol}]

Signal: ${signalType} (${confidence}% confidence)
Price: $${currentPrice.toFixed(2)}

Indicators:
- RSI (14): ${rsi.toFixed(1)} ${rsi < 30 ? "🟢 Oversold" : rsi > 70 ? "🔴 Overbought" : "⚪ Neutral"}
- MACD: ${macd.toFixed(4)} | Signal: ${signal.toFixed(4)} | ${histogram > 0 ? "🟢 Bullish" : "🔴 Bearish"}
- EMA 50: $${currentEMA50.toFixed(2)} ${currentPrice > currentEMA50 ? "🟢 Above" : "🔴 Below"}
- EMA 200: $${currentEMA200.toFixed(2)} ${currentPrice > currentEMA200 ? "🟢 Above" : "🔴 Below"}

Reasons:
${reasons.map(r => `• ${r}`).join("\n")}
${signalType === "BUY" ? `
Suggested:
• Stop Loss: $${stopLoss?.toFixed(2)} (-10%)
• Take Profit: $${takeProfit?.toFixed(2)} (+20%)` : ""}

Strategy: RSI + MACD + EMA (freqtrade-strategies)
Timeframe: ${timeframe}`;

      return {
        content: [{ type: "text", text: result }],
        structuredContent: {
          symbol,
          signal: signalType,
          confidence,
          price: currentPrice,
          indicators: { rsi, macd, signal, ema50: currentEMA50, ema200: currentEMA200 },
          stopLoss,
          takeProfit,
          reasons,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Signal error: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// TOOL 10: blockrun_swap (execute trades on DEX)
// ============================================================================

// 0x API for swap quotes on Base
const ZERO_X_API = "https://api.0x.org/swap/v1";
const BASE_CHAIN_ID_NUM = 8453;

// Common tokens on Base
const BASE_TOKENS: Record<string, string> = {
  "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "WETH": "0x4200000000000000000000000000000000000006",
  "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "USDbC": "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  "DAI": "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  "cbETH": "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
};

server.registerTool(
  "blockrun_swap",
  {
    description: `Execute token swaps on Base network using 0x aggregator.

⚠️ REAL MONEY - requires user confirmation before execution.

Example: blockrun_swap({ from: "USDC", to: "ETH", amount: 10 })`,
    inputSchema: {
      from: z.string().describe("Token to sell (USDC, ETH, WETH, etc.)"),
      to: z.string().describe("Token to buy"),
      amount: z.number().describe("Amount in 'from' token"),
      slippage: z.number().optional().default(0.5).describe("Max slippage % (default 0.5)"),
      execute: z.boolean().optional().default(false).describe("Set true to execute (requires confirmation)"),
    },
  },
  async ({ from, to, amount, slippage, execute }) => {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    const fromToken = BASE_TOKENS[fromUpper];
    const toToken = BASE_TOKENS[toUpper];

    if (!fromToken) {
      return {
        content: [{ type: "text", text: `Unknown token: ${from}. Supported: ${Object.keys(BASE_TOKENS).join(", ")}` }],
        isError: true,
      };
    }
    if (!toToken) {
      return {
        content: [{ type: "text", text: `Unknown token: ${to}. Supported: ${Object.keys(BASE_TOKENS).join(", ")}` }],
        isError: true,
      };
    }

    // Calculate amount in wei/smallest unit
    const decimals = fromUpper === "USDC" || fromUpper === "USDbC" ? 6 : 18;
    const amountWei = BigInt(Math.floor(amount * (10 ** decimals)));

    try {
      // Get quote from 0x
      const quoteUrl = `${ZERO_X_API}/quote?` + new URLSearchParams({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: amountWei.toString(),
        slippagePercentage: (slippage / 100).toString(),
        chainId: BASE_CHAIN_ID_NUM.toString(),
      });

      // Note: 0x API requires API key for production
      // For demo, return simulated quote
      const estimatedOutput = fromUpper === "USDC"
        ? amount / 3300 // Rough USDC to ETH
        : amount * 3300; // Rough ETH to USDC

      const quoteResult = `[Swap Quote: ${fromUpper} → ${toUpper}]

Sell: ${amount} ${fromUpper}
Buy (est): ~${estimatedOutput.toFixed(6)} ${toUpper}
Slippage: ${slippage}%
Network: Base

${execute ? "⚠️ EXECUTION REQUESTED" : "💡 Set execute: true to swap"}

Note: Full 0x integration requires API key.
For demo, this shows the quote flow.

To execute:
1. User confirms the swap
2. Wallet signs transaction
3. Swap executes on-chain
4. Returns tx hash`;

      if (execute) {
        // In production: would execute the swap
        // For now, return what would happen
        return {
          content: [{
            type: "text",
            text: `⚠️ SWAP EXECUTION DISABLED FOR SAFETY

To enable real swaps:
1. Add 0x API key
2. Implement transaction signing
3. Add confirmation flow

This is a demo. The swap would:
• Sell ${amount} ${fromUpper}
• Buy ~${estimatedOutput.toFixed(6)} ${toUpper}
• Gas: ~$0.01 on Base`,
          }],
        };
      }

      return {
        content: [{ type: "text", text: quoteResult }],
        structuredContent: {
          from: fromUpper,
          to: toUpper,
          sellAmount: amount,
          buyAmount: estimatedOutput,
          slippage,
          execute: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Swap error: ${errorMessage}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

server.registerResource(
  "wallet",
  "blockrun://wallet",
  { description: "Wallet address and status", mimeType: "application/json" },
  async () => ({
    contents: [{
      uri: "blockrun://wallet",
      mimeType: "application/json",
      text: JSON.stringify(getWalletInfo(), null, 2),
    }],
  })
);

server.registerResource(
  "models",
  "blockrun://models",
  { description: "Available AI models with pricing", mimeType: "application/json" },
  async () => {
    const llm = getClient();
    if (!cachedModels) {
      cachedModels = await llm.listModels();
      setTimeout(() => { cachedModels = null; }, 5 * 60 * 1000);
    }
    return {
      contents: [{
        uri: "blockrun://models",
        mimeType: "application/json",
        text: JSON.stringify(cachedModels, null, 2),
      }],
    };
  }
);

// ============================================================================
// START SERVER
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BlockRun MCP Server started (v0.4.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

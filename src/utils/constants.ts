import * as path from "path";
import * as os from "os";

export const WALLET_DIR = path.join(os.homedir(), ".blockrun");
export const WALLET_FILE = path.join(WALLET_DIR, ".session");
export const QR_FILE = path.join(WALLET_DIR, "qr.png");

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = "8453";
export const BASE_CHAIN_ID_NUM = 8453;
export const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

// Models organized by provider:
// OpenAI (13): openai/gpt-5.4, openai/gpt-5.4-pro, openai/gpt-5.3, openai/gpt-5.2,
//   openai/gpt-5.4-mini, openai/gpt-5-mini, openai/gpt-5.4-nano, openai/gpt-5.2-pro,
//   openai/gpt-5.3-codex, openai/o1, openai/o1-mini, openai/o3, openai/o3-mini
// Anthropic (4): anthropic/claude-haiku-4.5, anthropic/claude-sonnet-4.6,
//   anthropic/claude-opus-4.5, anthropic/claude-opus-4.6
// Google (7): google/gemini-3.1-pro, google/gemini-3-pro-preview, google/gemini-3-flash-preview,
//   google/gemini-2.5-pro, google/gemini-2.5-flash, google/gemini-3.1-flash-lite, google/gemini-2.5-flash-lite
// DeepSeek (2): deepseek/deepseek-chat, deepseek/deepseek-reasoner
// NVIDIA (12, most FREE): nvidia/gpt-oss-120b*, nvidia/gpt-oss-20b*, nvidia/kimi-k2.5,
//   nvidia/nemotron-ultra-253b*, nvidia/nemotron-3-super-120b*, nvidia/nemotron-super-49b*,
//   nvidia/deepseek-v3.2*, nvidia/mistral-large-3-675b*, nvidia/qwen3-coder-480b*,
//   nvidia/devstral-2-123b*, nvidia/glm-4.7*, nvidia/llama-4-maverick*  (* = free)
// ZAI (2): zai/glm-5, zai/glm-5-turbo
// MiniMax (1): minimax/minimax-m2.7
export const MODEL_TIERS = {
  fast: ["google/gemini-2.5-flash", "google/gemini-3.1-flash-lite", "openai/gpt-5-mini", "deepseek/deepseek-chat", "google/gemini-3-flash-preview"],
  balanced: ["openai/gpt-5.4", "anthropic/claude-sonnet-4.6", "google/gemini-2.5-pro", "openai/gpt-5.3", "google/gemini-3.1-pro"],
  powerful: ["openai/gpt-5.4-pro", "anthropic/claude-opus-4.6", "anthropic/claude-opus-4.5", "openai/o3", "openai/gpt-5.4"],
  cheap: ["zai/glm-5", "zai/glm-5-turbo", "nvidia/gpt-oss-120b", "nvidia/deepseek-v3.2", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "openai/gpt-5.4-nano"],
  reasoning: ["openai/o3", "openai/o1", "openai/o3-mini", "deepseek/deepseek-reasoner", "openai/gpt-5.3-codex"],
  free: ["nvidia/gpt-oss-120b", "nvidia/deepseek-v3.2", "nvidia/nemotron-ultra-253b", "nvidia/nemotron-super-49b", "nvidia/qwen3-coder-480b", "nvidia/llama-4-maverick", "nvidia/gpt-oss-20b", "nvidia/glm-4.7"],
  coding: ["zai/glm-5", "openai/gpt-5.3-codex", "nvidia/qwen3-coder-480b", "nvidia/devstral-2-123b", "anthropic/claude-sonnet-4.6", "openai/gpt-5.4"],
  glm: ["zai/glm-5", "zai/glm-5-turbo", "nvidia/glm-4.7"],
} as const;

export type RoutingMode = keyof typeof MODEL_TIERS;

export const BASE_TOKENS: Record<string, string> = {
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  WETH: "0x4200000000000000000000000000000000000006",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
};


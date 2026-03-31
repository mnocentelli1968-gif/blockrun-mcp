import * as path from "path";
import * as os from "os";

export const WALLET_DIR = path.join(os.homedir(), ".blockrun");
export const WALLET_FILE = path.join(WALLET_DIR, ".session");
export const QR_FILE = path.join(WALLET_DIR, "qr.png");

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = "8453";
export const BASE_CHAIN_ID_NUM = 8453;
export const ZERO_X_API = "https://api.0x.org/swap/v1";

export const BASE_RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://1rpc.io/base",
];

// All 41 models organized by provider:
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
  cheap: ["nvidia/gpt-oss-120b", "nvidia/deepseek-v3.2", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "openai/gpt-5.4-nano"],
  reasoning: ["openai/o3", "openai/o1", "openai/o3-mini", "deepseek/deepseek-reasoner", "openai/gpt-5.3-codex"],
  free: ["nvidia/gpt-oss-120b", "nvidia/deepseek-v3.2", "nvidia/nemotron-ultra-253b", "nvidia/nemotron-super-49b", "nvidia/qwen3-coder-480b", "nvidia/llama-4-maverick", "nvidia/gpt-oss-20b"],
  coding: ["openai/gpt-5.3-codex", "nvidia/qwen3-coder-480b", "nvidia/devstral-2-123b", "anthropic/claude-sonnet-4.6", "openai/gpt-5.4"],
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

export const KNOWN_LABELS: Record<string, string> = {
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

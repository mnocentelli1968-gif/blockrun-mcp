# @blockrun/mcp

**The payment layer for AI agents.**

[![npm version](https://img.shields.io/npm/v/@blockrun/mcp)](https://www.npmjs.com/package/@blockrun/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

BlockRun MCP is a Model Context Protocol server that gives any AI agent (Claude, GPT, Cursor, etc.) access to 41 LLM models, real-time web search, prediction markets, crypto DEX data, whale tracking, image generation, and token swaps — all paid via x402 micropayments in USDC on Base. No API keys. No subscriptions. No accounts.

---

## Why blockrun-mcp

Claude Code has task systems, token budgets, and multi-agent coordination. What it does not have: per-agent wallets, spending enforcement across sessions, or a way for a parent agent to delegate a budget to a child agent and block it when that budget is exhausted.

BlockRun fills this gap. Every tool call is a real micropayment — authorized locally by a wallet the agent controls. Parent agents can delegate spending limits to child agents by `agent_id`. Usage is auditable on-chain at any time.

This makes BlockRun the financial infrastructure layer for multi-agent systems, not just a model proxy.

---

## Quick Start

### Option 1: Hosted (zero install)

```bash
claude mcp add blockrun --transport http https://mcp.blockrun.ai/mcp
```

No Node.js. No npm. Works from any agent, CI/CD pipeline, or cloud environment. Pass your wallet key per-request via `X-Wallet-Key` header.

### Option 2: Local (self-hosted, private key never leaves your machine)

```bash
claude mcp add blockrun npx @blockrun/mcp
```

```bash
# Optional: bring your own wallet
claude mcp add blockrun npx @blockrun/mcp --env BLOCKRUN_WALLET_KEY=0x...
```

A wallet is automatically created on first use. Fund it with USDC on Base network and every tool is immediately available.

---

## What Your Agent Gets

| Tool | What it does | Cost |
|------|-------------|------|
| `blockrun_chat` | 41 AI models (GPT-5, Claude, Gemini, NVIDIA free) | per token |
| `blockrun_wallet` | Wallet management + multi-agent budget orchestration | free |
| `blockrun_search` | Web + news search with AI-summarized results | ~$0.01/search |
| `blockrun_exa` | Neural web search (Exa) — understands meaning, not just keywords | $0.01/call |
| `blockrun_twitter` | Real-time X/Twitter search via Grok | per token |
| `blockrun_markets` | Prediction markets — Polymarket, Kalshi, dFlow, Binance Futures | $0.001/call |
| `blockrun_image` | Image generation and editing (DALL-E 3, Flux) | $0.02–0.08 |
| `blockrun_dex` | Real-time DEX prices and liquidity via DexScreener | FREE |
| `blockrun_whale` | On-chain whale tracking — large ETH transfers via Etherscan | FREE |
| `blockrun_analyze` | Token technical analysis combining multiple data sources with AI | per token |
| `blockrun_signal` | Trading signals — RSI + MACD + EMA strategy | FREE |
| `blockrun_swap` | Token swap quotes on Base via 0x aggregator | FREE |
| `blockrun_models` | List all 41 models with pricing and context windows | FREE |

---

## Multi-Agent Budget Orchestration

A parent agent can allocate spending limits to child agents. Child agents self-identify via `agent_id`. When a child agent hits its limit, further calls are automatically blocked without any coordination logic needed in your code.

```typescript
// Parent agent allocates budgets to child agents
mcp.call("blockrun_wallet", { action: "delegate", agent_id: "researcher", agent_limit: 2.00 })
mcp.call("blockrun_wallet", { action: "delegate", agent_id: "writer", agent_limit: 0.50 })

// Child agents self-identify — auto-blocked at limit
mcp.call("blockrun_chat", { message: "...", routing: "smart", agent_id: "researcher" })

// Audit spending across all agents
mcp.call("blockrun_wallet", { action: "report" })
// researcher: $1.84/$2.00 (23 calls), writer: $0.31/$0.50 (4 calls)
```

This pattern works across sessions. The spending record is tied to the wallet, not the process.

---

## Smart Routing (ClawRouter)

Agents do not need to pick models. Pass `routing: "smart"` and ClawRouter selects the optimal model for the task based on the routing profile.

```typescript
// Auto-selects optimal model — agents never need to pick
blockrun_chat({ message: "...", routing: "smart", routing_profile: "eco" })
// Returns: [nvidia/deepseek-v3.2 | SIMPLE | $0.0001 | 94% savings]
```

| Profile | Description |
|---------|-------------|
| `free` | Zero cost — NVIDIA-hosted models only |
| `eco` | Budget-optimized — best quality per dollar |
| `auto` | Balanced — default |
| `premium` | Highest quality available |

---

## All 41 Models

### OpenAI (13 models)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `openai/gpt-5.2` | 128k | $21.00 | $84.00 |
| `openai/gpt-5` | 128k | $15.00 | $60.00 |
| `openai/gpt-5-mini` | 128k | $0.40 | $1.60 |
| `openai/gpt-4o` | 128k | $2.50 | $10.00 |
| `openai/gpt-4o-mini` | 128k | $0.15 | $0.60 |
| `openai/o3` | 200k | $10.00 | $40.00 |
| `openai/o3-mini` | 200k | $1.10 | $4.40 |
| `openai/o4-mini` | 200k | $1.10 | $4.40 |
| `openai/o1` | 200k | $15.00 | $60.00 |
| `openai/o1-mini` | 128k | $1.10 | $4.40 |
| `openai/o1-pro` | 200k | $150.00 | $600.00 |
| `openai/gpt-4.1` | 128k | $2.00 | $8.00 |
| `openai/gpt-4.1-mini` | 128k | $0.40 | $1.60 |

### Anthropic (4 models)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `anthropic/claude-opus-4` | 200k | $15.00 | $75.00 |
| `anthropic/claude-sonnet-4` | 200k | $3.00 | $15.00 |
| `anthropic/claude-sonnet-3-7` | 200k | $3.00 | $15.00 |
| `anthropic/claude-haiku-3-5` | 200k | $0.25 | $1.25 |

### Google (7 models)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `google/gemini-3-pro` | 1M | $2.50 | $15.00 |
| `google/gemini-2.5-pro` | 1M | $1.25 | $10.00 |
| `google/gemini-2.5-flash` | 1M | $0.15 | $0.60 |
| `google/gemini-2.0-flash` | 1M | $0.10 | $0.40 |
| `google/gemini-2.0-flash-lite` | 1M | $0.075 | $0.30 |
| `google/gemini-1.5-pro` | 2M | $1.25 | $5.00 |
| `google/gemini-1.5-flash` | 1M | $0.075 | $0.30 |

### DeepSeek (2 models)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `deepseek/deepseek-chat` | 64k | $0.14 | $0.28 |
| `deepseek/deepseek-reasoner` | 64k | $0.55 | $2.19 |

### NVIDIA (12 models — FREE)

All NVIDIA-hosted models are free via the `routing_profile: "free"` option or by specifying directly.

| Model ID |
|----------|
| `nvidia/deepseek-v3.2` |
| `nvidia/llama-3.3-70b` |
| `nvidia/llama-3.1-405b` |
| `nvidia/mistral-nemo-12b` |
| `nvidia/phi-4-mini` |
| `nvidia/qwen2.5-72b` |
| `nvidia/nemotron-70b` |
| `nvidia/nemotron-253b` |
| `nvidia/llama-3.1-nemotron-nano-8b` |
| `nvidia/llama-3.1-nemotron-ultra-253b` |
| `nvidia/mistral-small-3.1` |
| `nvidia/qwen3-235b` |

### ZAI (2 models)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `zai/grok-3` | 131k | $5.00 | $25.00 |
| `zai/grok-3-mini` | 131k | $3.00 | $15.00 |

### MiniMax (1 model)

| Model ID | Context | Input ($/M) | Output ($/M) |
|----------|---------|-------------|--------------|
| `minimax/minimax-m1` | 1M | $0.80 | $2.40 |

---

## How Payments Work

Every request is paid via the x402 protocol — an open payment standard for machine-to-machine micropayments. Payments settle in USDC on Base network. Your wallet is created automatically on first use and stored locally at `~/.blockrun/.session`. The private key is used only to sign payment authorizations locally — it is never transmitted to any server. You can verify all transactions on [Basescan](https://basescan.org).

---

## Funding Your Wallet

```
# Get your wallet address
blockrun_wallet({ action: "balance" })
# Returns: 0x... (QR code available for mobile wallets)
```

Send USDC on Base network to that address. $5 gets you started — approximately 50,000 Gemini Flash requests or 125 DALL-E 3 images. There is no minimum. You pay only for what you use.

| Method | Steps |
|--------|-------|
| Coinbase | Send → USDC → Select "Base" network → Paste address |
| Bridge | [bridge.base.org](https://bridge.base.org) → Bridge USDC to Base |
| Buy direct | [Coinbase Onramp](https://www.coinbase.com/onramp) → Buy USDC on Base |

---

## Architecture

```
Claude Code / Any MCP Client
        |
        | stdio (local) or HTTP (remote, coming soon)
        |
   blockrun-mcp server
        |
        | x402 micropayments (USDC on Base)
        |
   blockrun.ai gateway
        |
        +-- OpenAI
        +-- Anthropic
        +-- Google
        +-- NVIDIA
        +-- DeepSeek
        +-- ZAI / MiniMax
        +-- DexScreener / Etherscan / Polymarket / Kalshi / Exa / 0x
```

The MCP server runs locally (stdio transport). Each tool call that requires payment triggers a local wallet signature. The signed payment authorization is sent to the blockrun.ai gateway alongside the API request. No API keys pass through your machine.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `BLOCKRUN_WALLET_KEY` | Bring your own private key (hex string, starts with 0x). Optional — a wallet is auto-generated if not set. |

Wallet resolution order:
1. `BLOCKRUN_WALLET_KEY` environment variable
2. `BASE_CHAIN_WALLET_KEY` environment variable
3. `~/.blockrun/.session` (auto-created on first use)

---

## Development

```bash
git clone https://github.com/BlockRunAI/blockrun-mcp
cd blockrun-mcp
npm install
npm run build
npm run dev  # tsx watch — auto-reloads on changes
```

To test the server manually:

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
```

---

## Roadmap

- [x] 14 tools covering LLMs, search, crypto, markets, image generation
- [x] Multi-agent budget delegation via `agent_id`
- [x] ClawRouter intelligent model routing
- [x] Multi-turn conversation support
- [ ] HTTP/SSE transport (deploy to mcp.blockrun.ai — no local install needed)
- [ ] Per-tool LLM-optimized descriptions
- [ ] Official MCP registry listing
- [ ] Persistent cross-session spending records tied to wallet

---

## Links

- **Website:** [blockrun.ai](https://blockrun.ai)
- **npm:** [@blockrun/mcp](https://www.npmjs.com/package/@blockrun/mcp)
- **GitHub:** [github.com/blockrunai/blockrun-mcp](https://github.com/blockrunai/blockrun-mcp)
- **Issues:** [github.com/blockrunai/blockrun-mcp/issues](https://github.com/blockrunai/blockrun-mcp/issues)
- **Pricing:** [blockrun.ai/pricing](https://blockrun.ai/pricing)
- **Telegram:** [t.me/+mroQv4-4hGgzOGUx](https://t.me/+mroQv4-4hGgzOGUx)
- **X:** [@BlockRunAI](https://x.com/BlockRunAI)

---

## License

MIT

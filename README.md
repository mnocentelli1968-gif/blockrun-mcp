# @blockrun/mcp

**Give your AI agent superpowers — web search, deep research, prediction markets, crypto data, X/Twitter intelligence.**

[![npm version](https://img.shields.io/npm/v/@blockrun/mcp)](https://www.npmjs.com/package/@blockrun/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

BlockRun MCP gives your AI agent access to live data it can't get on its own — real-time web search, neural research, prediction markets, crypto DEX prices, and X/Twitter intelligence. All paid via x402 micropayments in USDC. No API keys. No subscriptions. No accounts.

---

## Install

```bash
claude mcp add blockrun npx @blockrun/mcp
```

That's it. A wallet is auto-created on first use. Fund it with USDC on Base and every tool is immediately available.

To make it available in **all** projects: add `--scope user`.

---

## Tools

| Tool | What it does | Cost |
|------|-------------|------|
| `blockrun_search` | Real-time web + news search | ~$0.01/search |
| `blockrun_exa` | Neural research (Exa) — finds papers, competitors, similar products | $0.01/call |
| `blockrun_twitter` | X/Twitter intelligence via Grok — search, trends, user analysis | per token |
| `blockrun_markets` | Prediction markets — Polymarket, Kalshi | $0.001/call |
| `blockrun_dex` | Real-time DEX prices and liquidity via DexScreener | FREE |
| `blockrun_image` | Image generation and editing (DALL-E 3, Flux) | $0.02–0.08 |
| `blockrun_chat` | Second opinion from another model (GPT, Gemini, DeepSeek, etc.) | per token |
| `blockrun_wallet` | Wallet balance, agent budgets, spending reports | FREE |
| `blockrun_models` | List all models with pricing | FREE |

---

## Fund Your Wallet

```
blockrun_wallet action:"status"
```

This shows your wallet address. Send USDC on Base network to that address.

$5 gets you started — that's ~500 Exa searches or ~50,000 Gemini Flash calls.

| Method | Steps |
|--------|-------|
| Coinbase | Send → USDC → Select "Base" network → Paste address |
| Bridge | [bridge.base.org](https://bridge.base.org) → Bridge USDC to Base |

---

## Why BlockRun

Your AI agent already has an LLM. What it doesn't have: access to the live internet, research tools, market data, or a way to pay for services autonomously.

BlockRun fills this gap. Every tool call is a real micropayment — authorized locally by a wallet the agent controls. No API keys to manage, no vendor accounts to create. Just a wallet and USDC.

For multi-agent systems: parent agents can delegate spending limits to child agents by `agent_id`. When a child hits its limit, further calls are automatically blocked.

---

## How Payments Work

Every request is paid via the [x402 protocol](https://x402.org) — an open standard for machine-to-machine micropayments. Payments settle in USDC on Base (or Solana). Your wallet is created automatically on first use and stored locally at `~/.blockrun/.session`. The private key is used only to sign payment authorizations locally — it is never transmitted to any server.

---

## Hosted Option

Don't want to install locally? Use the hosted version:

```bash
claude mcp add --scope user --transport http blockrun https://mcp.blockrun.ai/mcp
```

Run `blockrun_wallet` for wallet setup instructions.

---

## Links

- **Website:** [blockrun.ai](https://blockrun.ai)
- **npm:** [@blockrun/mcp](https://www.npmjs.com/package/@blockrun/mcp)
- **Hosted MCP:** [mcp.blockrun.ai](https://mcp.blockrun.ai)
- **GitHub:** [github.com/blockrunai/blockrun-mcp](https://github.com/blockrunai/blockrun-mcp)
- **Telegram:** [t.me/+mroQv4-4hGgzOGUx](https://t.me/+mroQv4-4hGgzOGUx)
- **X:** [@BlockRunAI](https://x.com/BlockRunAI)

---

## License

MIT

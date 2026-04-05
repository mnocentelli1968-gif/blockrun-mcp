# BlockRun MCP

**Give Claude real-time data it doesn't have natively — markets, research, X/Twitter, crypto, images.**

[![npm](https://img.shields.io/npm/v/@blockrun/mcp)](https://www.npmjs.com/package/@blockrun/mcp)

Claude's knowledge cuts off in early 2025. It can't check what Polymarket says about the election, find papers published last month, look up who's trending on X, or see live token prices. BlockRun plugs those gaps — no API keys, no subscriptions, just USDC micropayments ($5 covers hundreds of queries).

```bash
claude mcp add blockrun npx @blockrun/mcp
```

Wallet auto-created on first use. Fund with USDC on Base. Done.

---

## What You Can Ask Claude

Once installed, Claude can answer questions it normally can't:

**Research**
> "Find recent papers on transformer inference optimization and summarize the key techniques"

> "Who are Polymarket's main competitors? Fetch their homepages and compare positioning"

> "What does this URL say?" *(paste any link — Claude reads it)*

**Markets & Predictions**
> "What's the current Polymarket probability that Bitcoin hits $100k this year?"

> "Show me the most-traded Kalshi markets right now"

> "What are people betting on in crypto this week?"

**Crypto & DeFi**
> "What's the current price and 24h volume of PEPE on Uniswap?"

> "Find all DEX pairs for this token address"

**X / Twitter**
> "What's trending in AI on X right now?"

> "Analyze @elonmusk's last 50 tweets — what topics does he post most about?"

> "Who are the most influential people tweeting about DePIN?"

**Images & Other Models**
> "Generate a logo for my startup using DALL-E 3"

> "What does GPT-4o think about this code? Get a second opinion"

---

## Install

**Local (recommended)**
```bash
claude mcp add blockrun npx @blockrun/mcp
```

**Hosted (no install, always up to date)**
```bash
claude mcp add --transport http blockrun https://mcp.blockrun.ai/mcp
```

---

## Fund Your Wallet

Run `blockrun_wallet` in Claude to see your address, then send USDC on Base.

| What | Cost | $5 buys you |
|------|------|-------------|
| Prediction market lookup | $0.001 | 5,000 queries |
| Exa neural search | $0.01 | 500 searches |
| Web search | ~$0.01 | ~500 searches |
| DEX price check | free | unlimited |
| Image generation | $0.02–0.08 | 60–250 images |
| GPT-4o / Gemini chat | per token | varies |

| Funding method | How |
|----------------|-----|
| Coinbase | Send → USDC → Base network → paste address |
| Bridge | [bridge.base.org](https://bridge.base.org) |

---

## Tools

| Tool | Description |
|------|-------------|
| `blockrun_exa` | Neural web search — finds semantically relevant content, fetches full page text, discovers similar sites, returns cited answers |
| `blockrun_markets` | Real-time prediction market data from Polymarket, Kalshi, dFlow, and Binance Futures |
| `blockrun_search` | Web + news search with citations |
| `blockrun_twitter` | X/Twitter: profiles, followers, tweets, trends, search, analytics. 15 endpoints + Grok Live Search |
| `blockrun_dex` | Live DEX prices, liquidity, and pair data via DexScreener |
| `blockrun_image` | Image generation (DALL-E 3, Flux) and editing |
| `blockrun_chat` | Access GPT-4o, Gemini, DeepSeek, and 30+ other models |
| `blockrun_wallet` | Check balance, view spending, manage agent budgets |
| `blockrun_models` | List available models and pricing |

---

## How It Works

Pay-per-call via [x402](https://x402.org) micropayments in USDC on Base. Your wallet lives at `~/.blockrun/.session` — private key never leaves your machine.

**Multi-agent:** delegate budgets to child agents with `agent_id`. Agents are auto-blocked when budget runs out.

---

[blockrun.ai](https://blockrun.ai) · [npm](https://www.npmjs.com/package/@blockrun/mcp) · [@BlockRunAI](https://x.com/BlockRunAI)

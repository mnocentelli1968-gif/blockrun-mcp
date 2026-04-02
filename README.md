# @blockrun/mcp

**Live data for AI agents — search, research, markets, crypto, X/Twitter.**

[![npm](https://img.shields.io/npm/v/@blockrun/mcp)](https://www.npmjs.com/package/@blockrun/mcp)

```bash
claude mcp add blockrun npx @blockrun/mcp
```

Wallet auto-created. Fund with USDC on Base. Done.

---

## Tools

| Tool | What it does | Cost |
|------|-------------|------|
| `blockrun_search` | Web + news search | ~$0.01 |
| `blockrun_exa` | Neural research — papers, competitors, similar products | $0.01 |
| `blockrun_twitter` | X/Twitter via Grok — trends, sentiment, @handles | per token |
| `blockrun_markets` | Prediction markets — Polymarket, Kalshi | $0.001 |
| `blockrun_dex` | DEX prices via DexScreener | free |
| `blockrun_image` | Image gen (DALL-E 3, Flux) | $0.02-0.08 |
| `blockrun_chat` | Second opinion from GPT, Gemini, DeepSeek, etc. | per token |
| `blockrun_wallet` | Balance, budgets, spending | free |
| `blockrun_models` | List models + pricing | free |

---

## Fund Your Wallet

Run `blockrun_wallet` to see your address, then send USDC on Base. $5 = ~500 Exa searches.

| Method | How |
|--------|-----|
| Coinbase | Send → USDC → Base network → paste address |
| Bridge | [bridge.base.org](https://bridge.base.org) |

---

## How It Works

Pay-per-call via [x402](https://x402.org) micropayments in USDC. Wallet stored locally at `~/.blockrun/.session`. Private key never leaves your machine.

For multi-agent systems: delegate budgets to child agents with `agent_id`. Auto-blocked when budget runs out.

---

## Hosted (no install)

```bash
claude mcp add --transport http blockrun https://mcp.blockrun.ai/mcp
```

---

[blockrun.ai](https://blockrun.ai) · [npm](https://www.npmjs.com/package/@blockrun/mcp) · [github](https://github.com/blockrunai/blockrun-mcp) · [@BlockRunAI](https://x.com/BlockRunAI)

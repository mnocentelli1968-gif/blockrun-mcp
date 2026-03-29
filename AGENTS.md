# AGENTS.md

Guidance for AI coding agents working with the BlockRun MCP Server.

## Project Overview

**@blockrun/mcp** is an MCP (Model Context Protocol) server that gives Claude Code access to 30+ AI models, image generation, X/Twitter data, DEX data, whale tracking, trading signals, and DEX swaps — all via x402 USDC micropayments on Base. No API keys required.

**Package:** `@blockrun/mcp` (npm)
**Node:** >=18
**Network:** Base (Chain ID: 8453)
**Payment:** USDC via x402 v2
**SDK dependency:** `@blockrun/llm` (all API calls go through this)

## Repository Structure

```
blockrun-mcp/
├── src/
│   └── index.ts         # Entire server — all tools, resources, wallet logic
├── dist/                # Build output (generated, do not edit)
├── docs/
│   ├── plans/           # Implementation plans
│   └── outreach/        # Marketing and outreach materials
├── package.json
├── tsconfig.json
├── smithery.yaml        # Smithery registry metadata
├── server.json          # MCP server definition
└── README.md
```

**All server logic lives in `src/index.ts`.** There are no sub-modules.

## Development Commands

```bash
# Install
npm install              # or pnpm install

# Build
npm run build            # tsup — outputs dist/index.js + dist/index.d.ts

# Dev (watch mode)
npm run dev

# Type check
npm run typecheck

# Run the server locally (for testing)
node dist/index.js
```

## Architecture

### Single-file server pattern

The entire MCP server is `src/index.ts`. New tools are added by:
1. Calling `server.tool(name, description, zodSchema, handler)` — or the equivalent SDK method
2. Adding the tool to the `switch` in `server.setRequestHandler` (if using the older pattern)
3. Exporting nothing — this is a standalone executable, not a library

### Tool registration pattern

Tools follow this structure:

```typescript
server.tool(
  "blockrun_example",
  "Description of what the tool does",
  {
    // Zod schema for input parameters
    param1: z.string().describe("What param1 does"),
    param2: z.number().optional().describe("Optional number"),
  },
  async ({ param1, param2 }) => {
    try {
      // Budget check first
      if (sessionBudget.limit !== null && sessionBudget.spent >= sessionBudget.limit) {
        return {
          content: [{ type: "text", text: `Budget limit reached ($${sessionBudget.spent.toFixed(4)} of $${sessionBudget.limit?.toFixed(2)}). Use blockrun_wallet with action: "budget" to adjust.` }],
        };
      }

      const client = getClient();
      const result = await client.someMethod(param1);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("Payment") || errMsg.includes("402")) {
        return {
          content: [{ type: "text", text: `Payment required. Run blockrun_wallet with action: "setup" for funding instructions.\nError: ${errMsg}` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: `Error: ${errMsg}` }], isError: true };
    }
  }
);
```

### Key globals

| Variable | Purpose |
|----------|---------|
| `server` | `McpServer` instance |
| `getClient()` | Returns `LLMClient` initialized with wallet key |
| `sessionBudget` | `{ limit: number \| null, spent: number }` — tracks session spend |
| `walletAddress` | Resolved wallet address string |
| `cachedModels` | `Model[] \| null` — 5-minute model list cache |
| `WALLET_FILE` | `~/.blockrun/.session` — persisted wallet key |

### Wallet resolution order

1. `BLOCKRUN_WALLET_KEY` env var
2. `BASE_CHAIN_WALLET_KEY` env var
3. `~/.blockrun/.session` file (auto-generated on first run)

## Current Tools (v0.5.0)

| # | Tool | Description | Cost |
|---|------|-------------|------|
| 1 | `blockrun_wallet` | Setup, status, balance, QR code, budget management | Free |
| 2 | `blockrun_chat` | Chat with 30+ models, smart routing, streaming | Per token |
| 3 | `blockrun_models` | List available models with pricing | Free |
| 4 | `blockrun_image` | Generate images (DALL-E, Flux, etc.) | Per image |
| 5 | `blockrun_twitter` | X/Twitter user, tweet, search, analytics (15 endpoints) | Per call |
| 6 | `blockrun_dex` | DexScreener token/pair data | Free |
| 7 | `blockrun_whale` | BigQuery on-demand whale tracking | Per query |
| 8 | `blockrun_analyze` | Multi-source trading decision synthesis | Per query |
| 9 | `blockrun_signal` | RSI + MACD + EMA trading signals (Binance) | Free |
| 10 | `blockrun_swap` | Execute DEX swaps (Uniswap v3 on Base) | Gas + fee |

## Resources

| Resource URI | Description |
|-------------|-------------|
| `blockrun://wallet` | Current wallet address and status (JSON) |
| `blockrun://models` | Available models with pricing (JSON, 5-min cache) |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entire server — tools, resources, wallet, startup |
| `package.json` | Dependencies; `@blockrun/llm` is the main SDK dep |
| `smithery.yaml` | Smithery registry definition |
| `server.json` | MCP server metadata |

## Dependencies

- **`@blockrun/llm`** — BlockRun SDK for all AI/data API calls and x402 payment handling
- **`@modelcontextprotocol/sdk`** — MCP server framework
- **`zod`** — Input schema validation (v4)
- **`viem`** — Wallet key generation
- **`jimp`** — QR code image rendering
- **`qrcode`** — QR code generation
- **`open`** — Open QR image in system browser

## Adding a New Tool

1. Add after the last `server.tool(...)` call and before the `// RESOURCES` section
2. Use the tool registration pattern above
3. Always include budget check at the top of the handler
4. Handle payment errors specifically (check for "Payment" or "402" in error message)
5. Update the tool count in `src/index.ts` header comment and in this AGENTS.md
6. Bump `version` in `package.json`

## Versioning

`package.json` version is bumped manually:
- **patch** (0.5.x): Bug fixes, dependency updates
- **minor** (0.x.0): New tools, new features
- **major** (x.0.0): Breaking changes to existing tool interfaces

## Publishing

```bash
npm run build
npm publish --access public
```

## Security Notes

- Private keys are read from env vars or `~/.blockrun/.session` — never hardcoded
- Keys are used only for local EIP-712 signing; only signatures are transmitted
- `getClient()` throws if no wallet is found, returning an instructive error to the user
- Budget enforcement prevents runaway spending in autonomous agent loops

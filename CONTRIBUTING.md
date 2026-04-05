# Contributing to BlockRun MCP

## Setup

```bash
git clone https://github.com/BlockRunAI/blockrun-mcp
cd blockrun-mcp
npm install
npm run build
```

## Development

```bash
npm run dev    # watch mode
npm run typecheck
```

The MCP server runs on stdio. Test it by running `node dist/index.js` and sending JSON-RPC messages.

## Adding a tool

1. Create `src/tools/your-tool.ts` following the pattern in `src/tools/markets.ts`
2. Register it in `src/index.ts` via `registerYourTool(server)`
3. Add pricing to README

## Testing locally with Claude Code

```bash
claude mcp add blockrun-dev node /path/to/blockrun-mcp/dist/index.js
```

## Submitting changes

- Open a PR against `main`
- One feature/fix per PR
- Include what the tool does and its cost in the PR description

## Questions

[blockrun.ai](https://blockrun.ai) · [@BlockRunAI](https://x.com/BlockRunAI)

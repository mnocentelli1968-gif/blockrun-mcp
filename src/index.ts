#!/usr/bin/env node
/**
 * BlockRun MCP Server v0.5.0
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
import { initializeMcpServer } from "./mcp-handler.js";

const server = new McpServer({
  name: "blockrun-mcp",
  version: "0.5.0",
});

initializeMcpServer(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BlockRun MCP Server started (v0.5.0)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

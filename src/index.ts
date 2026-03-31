#!/usr/bin/env node
/**
 * BlockRun MCP Server v0.5.1
 *
 * Access 41+ AI models (GPT-5, Claude, Gemini, etc.) via x402 micropayments.
 * No API keys needed - just a wallet with USDC on Base.
 *
 * Transports:
 *   stdio (default):  claude mcp add blockrun npx @blockrun/mcp
 *   HTTP:             npx @blockrun/mcp --http [--port 3402]
 *
 * Tools: 13 total
 *   Paid (x402): chat, image, twitter, search, exa, markets
 *   Free (on-chain): dex, whale, signal, swap, analyze
 *   Utility: wallet, models
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeMcpServer } from "./mcp-handler.js";

const args = process.argv.slice(2);
const isHttp = args.includes("--http");
const portIdx = args.indexOf("--port");
const port = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 3402;

async function main() {
  if (isHttp) {
    // HTTP transport — for CCR cloud, claudeai-proxy, web agents
    const { startHttpServer } = await import("./http-server.js");
    await startHttpServer(port);
  } else {
    // stdio transport — default, for local Claude Code
    const server = new McpServer({
      name: "blockrun-mcp",
      version: "0.5.1",
    });

    initializeMcpServer(server);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("BlockRun MCP Server started (v0.5.1) — stdio transport");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * BlockRun MCP Server
 *
 * Give your AI agent superpowers — web search, deep research,
 * prediction markets, crypto data, X/Twitter intelligence.
 *
 * Usage:
 *   claude mcp add blockrun -- npx @blockrun/mcp
 *
 * For hosted version: https://mcp.blockrun.ai
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initializeMcpServer } from "./mcp-handler.js";

async function main() {
  const server = new McpServer({
    name: "blockrun-mcp",
    version: "0.6.4",
  });

  initializeMcpServer(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BlockRun MCP Server started (v0.6.4) — stdio transport");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

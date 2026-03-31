#!/usr/bin/env node
/**
 * BlockRun MCP Server — HTTP Transport
 *
 * Runs as an HTTP server for:
 * - Claude.ai connectors (claudeai-proxy)
 * - Claude Code Remote (CCR) cloud sessions
 * - Web-based agents
 * - Any MCP client supporting HTTP transport
 *
 * Usage:
 *   npx @blockrun/mcp --http              # Start HTTP server on port 3402
 *   npx @blockrun/mcp --http --port 8080  # Custom port
 *
 * The server implements the MCP Streamable HTTP transport specification,
 * supporting both SSE streaming and direct HTTP responses.
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { initializeMcpServer } from "./mcp-handler.js";

const DEFAULT_PORT = 3402; // x402 → 3402

export async function startHttpServer(port: number = DEFAULT_PORT): Promise<void> {
  const server = new McpServer({
    name: "blockrun-mcp",
    version: "0.5.1",
  });

  initializeMcpServer(server);

  // Stateful transport — each client gets a session ID
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

  const httpServer = createServer((req, res) => {
    // CORS headers for web-based clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "blockrun-mcp", version: "0.5.1", transport: "http" }));
      return;
    }

    // MCP endpoint — delegate to StreamableHTTPServerTransport
    if (req.url === "/mcp" || req.url === "/") {
      transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(port, () => {
    console.error(`BlockRun MCP Server (HTTP) listening on http://localhost:${port}`);
    console.error(`MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.error("Shutting down...");
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// src/tools/markets.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerMarketsTool(server: McpServer): void {
  server.registerTool(
    "blockrun_markets",
    {
      description: `Prediction market data. Real-time from Polymarket, Kalshi.

Example paths:
- "polymarket/events" — list active events
- "polymarket/markets" — list markets
- "kalshi/markets" — Kalshi markets
- "kalshi/markets/KXBTC-25MAR14" — specific market

$0.001/call.`,
      inputSchema: {
        path: z.string().describe("Endpoint path, e.g. 'polymarket/events', 'kalshi/markets/KXBTC-25MAR14'"),
        params: z.record(z.string(), z.string()).optional().describe("Query parameters for GET requests"),
        body: z.any().optional().describe("JSON body for POST queries (triggers pmQuery)"),
      },
    },
    async ({ path, params, body }) => {
      try {
        const llm = getClient();
        const result = body
          ? await llm.pmQuery(path, body)
          : await llm.pm(path, params);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: formatError(errMsg) }],
          isError: true,
        };
      }
    }
  );
}

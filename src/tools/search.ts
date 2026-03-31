// src/tools/search.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    "blockrun_search",
    {
      description: `Real-time web, X/Twitter, and news search with AI-summarized results and citations.

Sources: web, x (X/Twitter), news — defaults to all three.
Pricing: ~$0.01/search

Returns a summary with cited sources.`,
      inputSchema: {
        query: z.string().describe("Search query"),
        sources: z.array(z.enum(["web", "x", "news"])).optional().describe("Sources to search (default: web + x + news)"),
        max_results: z.number().optional().default(10).describe("Max results per source (1-20)"),
        from_date: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
        to_date: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      },
    },
    async ({ query, sources, max_results, from_date, to_date }) => {
      try {
        const llm = getClient();
        const result = await llm.search(query, {
          sources,
          maxResults: max_results,
          fromDate: from_date,
          toDate: to_date,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>,
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

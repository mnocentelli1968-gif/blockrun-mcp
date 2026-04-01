// src/tools/exa.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerExaTool(server: McpServer): void {
  server.registerTool(
    "blockrun_exa",
    {
      description: `Neural web search via Exa. Understands meaning, not just keywords. Great for research.

Actions:
- search: Find semantically relevant URLs and metadata ($0.01/call)
- answer: Get a cited, hallucination-free answer grounded in real web sources ($0.01/call)
- contents: Fetch full Markdown text from URLs, ready for LLM context ($0.002/URL)
- similar: Find pages semantically similar to a given URL ($0.01/call)`,
      inputSchema: {
        action: z.enum(["search", "answer", "contents", "similar"]).describe("Action to perform"),
        query: z.string().optional().describe("Natural language query (for search/answer)"),
        url: z.string().optional().describe("Reference URL to find similar pages (for similar action)"),
        urls: z.array(z.string()).optional().describe("URLs to fetch content from (for contents action, up to 100)"),
        num_results: z.number().optional().describe("Number of results to return (default: 10)"),
        category: z.string().optional().describe("Category filter: 'news', 'research paper', 'company', 'tweet', 'github', 'pdf'"),
        include_domains: z.array(z.string()).optional().describe("Only search within these domains"),
        exclude_domains: z.array(z.string()).optional().describe("Exclude these domains from results"),
      },
    },
    async ({ action, query, url, urls, num_results, category, include_domains, exclude_domains }) => {
      try {
        const llm = getClient();
        let result;

        const req = llm as unknown as { requestWithPaymentRaw: (endpoint: string, body: unknown) => Promise<unknown> };

        switch (action) {
          case "search":
            if (!query) throw new Error("query required for search action");
            result = await req.requestWithPaymentRaw("/v1/exa/search", {
              query,
              numResults: num_results,
              category,
              includeDomains: include_domains,
              excludeDomains: exclude_domains,
            });
            break;
          case "answer":
            if (!query) throw new Error("query required for answer action");
            result = await req.requestWithPaymentRaw("/v1/exa/answer", { query });
            break;
          case "contents":
            if (!urls?.length) throw new Error("urls array required for contents action");
            result = await req.requestWithPaymentRaw("/v1/exa/contents", { urls });
            break;
          case "similar":
            if (!url) throw new Error("url required for similar action");
            result = await req.requestWithPaymentRaw("/v1/exa/find-similar", {
              url,
              numResults: num_results,
            });
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

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

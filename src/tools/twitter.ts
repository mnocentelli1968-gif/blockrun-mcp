// src/tools/twitter.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";
import { checkBudget, recordSpending } from "../utils/budget.js";
import type { BudgetState } from "../types.js";

export function registerTwitterTool(server: McpServer, budget: BudgetState): void {
  server.registerTool(
    "blockrun_twitter",
    {
      description: `Search real-time X/Twitter via Grok. Use for trending topics, @handles, breaking news.`,
      inputSchema: {
        query: z.string().describe("Search query (can include @handles, topics)"),
        max_results: z.number().optional().default(10).describe("Max results (1-25)"),
      },
    },
    async ({ query, max_results }) => {
      const budgetCheck = checkBudget(budget);
      if (!budgetCheck.allowed) {
        return {
          content: [{ type: "text", text: `Budget limit reached ($${budget.spent.toFixed(4)} of $${budget.limit?.toFixed(2)}). Use blockrun_wallet with action: "budget" to adjust.` }],
          isError: true,
        };
      }

      try {
        const llm = getClient();
        const response = await llm.chat("xai/grok-3", query, {
          system: `Real-time X/Twitter search. Focus on recent posts, key accounts, engagement. Max results: ${max_results}`,
          search: true,
        } as Parameters<typeof llm.chat>[2] & { search?: boolean });

        recordSpending(budget, 0.002);

        return {
          content: [{ type: "text", text: `[X/Twitter via Grok]\n\n${response}` }],
          structuredContent: { query, model: "xai/grok-3", response },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: formatError(errorMessage) }],
          isError: true,
        };
      }
    }
  );
}

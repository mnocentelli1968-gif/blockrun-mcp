// src/tools/models.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Model } from "@blockrun/llm";
import { getClient } from "../utils/wallet.js";

export function registerModelsTool(server: McpServer, modelCache: { models: Model[] | null }): void {
  server.registerTool(
    "blockrun_models",
    {
      description: "List available AI models with pricing. Use to discover models and compare costs.",
      inputSchema: {
        category: z.enum(["all", "chat", "reasoning", "image", "embedding"]).optional().default("all").describe("Filter by category"),
        provider: z.string().optional().describe("Filter by provider (e.g., 'openai', 'anthropic')"),
      },
    },
    async ({ category, provider }) => {
      const llm = getClient();

      if (!modelCache.models) {
        modelCache.models = await llm.listModels();
        setTimeout(() => { modelCache.models = null; }, 5 * 60 * 1000);
      }

      let models = modelCache.models;

      if (provider) {
        const p = provider.toLowerCase();
        models = models.filter(m => m.id.toLowerCase().startsWith(p + "/"));
      }

      if (category && category !== "all") {
        if (category === "image") {
          models = models.filter(m => m.id.includes("dall-e") || m.id.includes("flux") || m.id.includes("banana"));
        } else if (category === "embedding") {
          models = models.filter(m => m.id.includes("embed"));
        } else {
          // Use categories from API for chat/reasoning filtering
          models = models.filter(m => m.categories?.includes(category));
        }
      }

      const lines = models.map(m => {
        const input = m.inputPrice ? `$${m.inputPrice}/M in` : "";
        const output = m.outputPrice ? `$${m.outputPrice}/M out` : "";
        const pricing = [input, output].filter(Boolean).join(", ");
        const ctx = m.contextWindow ? ` | ${Math.round(m.contextWindow / 1000)}K ctx` : "";
        const cats = m.categories?.length ? ` [${m.categories.join(", ")}]` : "";
        return `- ${m.id}${pricing ? ` (${pricing})` : ""}${ctx}${cats}`;
      });

      return {
        content: [{ type: "text", text: `Models (${models.length}):\n${lines.join("\n")}` }],
        structuredContent: { count: models.length, models },
      };
    }
  );
}

// src/tools/chat.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";
import { MODEL_TIERS, type RoutingMode } from "../utils/constants.js";

export function registerChatTool(server: McpServer): void {
  server.registerTool(
    "blockrun_chat",
    {
      description: `Chat with AI models via BlockRun. Supports 30+ models with pay-per-request micropayments.

Two ways to use:
1. Specify a model directly: model: "openai/gpt-5.4"
2. Use smart routing: mode: "fast" | "balanced" | "powerful" | "cheap" | "reasoning"

Popular models:
- openai/gpt-5.4, openai/gpt-5.4-mini, openai/gpt-5.4-nano
- anthropic/claude-opus-4.6, anthropic/claude-sonnet-4.6
- google/gemini-2.5-pro, google/gemini-2.5-flash
- deepseek/deepseek-chat (very affordable)

Smart routing modes:
- fast: Gemini Flash, GPT-5 Mini (quickest)
- balanced: GPT-5.4, Claude Sonnet 4.6 (good default)
- powerful: GPT-5.4, Claude Opus 4.6 (best quality)
- cheap: DeepSeek, Gemini Flash (lowest cost)
- reasoning: o3, o1 (complex logic)

Use blockrun_models to see all available models with pricing.`,
      inputSchema: {
        message: z.string().describe("Your message to the AI"),
        model: z.string().optional().describe("Specific model ID (e.g., 'openai/gpt-4o')"),
        mode: z.enum(["fast", "balanced", "powerful", "cheap", "reasoning"]).optional().describe("Smart routing mode (ignored if model specified)"),
        system: z.string().optional().describe("Optional system prompt"),
        max_tokens: z.number().optional().default(1024).describe("Max tokens in response"),
        temperature: z.number().optional().default(1).describe("Creativity 0-2"),
      },
    },
    async ({ message, model, mode, system, max_tokens, temperature }) => {
      const llm = getClient();

      // If specific model provided, use it directly
      if (model) {
        try {
          const response = await llm.chat(model, message, {
            system,
            maxTokens: max_tokens,
            temperature,
          });
          return { content: [{ type: "text", text: response }] };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: "text", text: formatError(errorMessage) }],
            isError: true,
          };
        }
      }

      // Smart routing mode
      const routingMode: RoutingMode = mode || "balanced";
      const models = MODEL_TIERS[routingMode];

      let lastError: Error | null = null;
      for (const m of models) {
        try {
          const response = await llm.chat(m, message, {
            system,
            maxTokens: max_tokens,
          });
          return {
            content: [{ type: "text", text: `[${m}]\n\n${response}` }],
            structuredContent: { model_used: m, response },
          };
        } catch (error) {
          lastError = error as Error;
          continue;
        }
      }

      const errorMessage = lastError?.message || "All models failed";
      return {
        content: [{ type: "text", text: formatError(errorMessage) }],
        isError: true,
      };
    }
  );
}

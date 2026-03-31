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
      description: `Chat with 41 AI models from 7 providers via BlockRun micropayments. No API keys needed.
Recommended for agents: use routing: "smart" to auto-select the optimal model via ClawRouter.
routing_profile: "free" (zero cost NVIDIA), "eco" (budget), "auto" (balanced, default), "premium" (best quality)

Three ways to use:
1. ClawRouter (recommended): routing: "smart" — auto-selects optimal model via 14-dimension AI routing
2. Direct model: model: "openai/gpt-5.4"
3. Smart routing: mode: "fast"|"balanced"|"powerful"|"cheap"|"reasoning"|"free"|"coding"
4. Multi-turn: pass messages[] array (conversation history) — "message" is appended as the final user turn

All providers (format: provider/model-id):
• OpenAI (13): gpt-5.4, gpt-5.4-pro, gpt-5.3, gpt-5.2, gpt-5.4-mini, gpt-5-mini, gpt-5.4-nano, gpt-5.2-pro, gpt-5.3-codex, o1, o1-mini, o3, o3-mini
• Anthropic (4): claude-haiku-4.5, claude-sonnet-4.6, claude-opus-4.5, claude-opus-4.6
• Google (7): gemini-3.1-pro, gemini-3-pro-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-3.1-flash-lite, gemini-2.5-flash-lite
• DeepSeek (2): deepseek-chat, deepseek-reasoner
• NVIDIA (12, most FREE*): gpt-oss-120b*, gpt-oss-20b*, kimi-k2.5, nemotron-ultra-253b*, nemotron-3-super-120b*, nemotron-super-49b*, deepseek-v3.2*, mistral-large-3-675b*, qwen3-coder-480b*, devstral-2-123b*, glm-4.7*, llama-4-maverick*
• ZAI (2): glm-5, glm-5-turbo
• MiniMax (1): minimax-m2.7

Smart routing modes:
- fast: Gemini Flash, GPT-5 Mini (lowest latency)
- balanced: GPT-5.4, Claude Sonnet 4.6, Gemini Pro (best default)
- powerful: GPT-5.4-Pro, Claude Opus 4.6 (highest quality)
- cheap: NVIDIA free + DeepSeek (lowest cost)
- reasoning: o3, o1, DeepSeek Reasoner (complex logic)
- free: All free NVIDIA models (zero cost)
- coding: GPT-5.3-Codex, Qwen3-Coder, Devstral (code tasks)

Run blockrun_models for live pricing.`,
      inputSchema: {
        message: z.string().describe("Your message to the AI"),
        model: z.string().optional().describe("Specific model ID (e.g., 'openai/gpt-4o')"),
        mode: z.enum(["fast", "balanced", "powerful", "cheap", "reasoning", "free", "coding"]).optional().describe("Smart routing mode (ignored if model specified)"),
        routing: z.enum(["smart"]).optional().describe('Set to "smart" to auto-select the optimal model via ClawRouter (14-dimension AI routing)'),
        routing_profile: z.enum(["free", "eco", "auto", "premium"]).optional().default("auto").describe('Cost/quality profile for ClawRouter: "free" (zero cost NVIDIA), "eco" (budget), "auto" (balanced, default), "premium" (best quality) (only applies when routing: "smart")'),
        system: z.string().optional().describe("Optional system prompt"),
        max_tokens: z.number().optional().default(1024).describe("Max tokens in response"),
        temperature: z.number().optional().default(1).describe("Creativity 0-2"),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })).optional().describe("Conversation history for multi-turn context. When provided, 'message' is appended as the final user turn. Use with explicit 'model' param (defaults to 'openai/gpt-5.4' if not specified). Note: if you include a role:'system' entry in messages[], do not also pass the system param to avoid duplicate system messages."),
      },
    },
    async ({ message, model, mode, routing, routing_profile, system, max_tokens, temperature, messages }) => {
      const llm = getClient();

      // ClawRouter smart routing
      if (routing === "smart") {
        try {
          const result = await llm.smartChat(message, {
            system,
            maxTokens: max_tokens,
            temperature,
            routingProfile: routing_profile,
          });
          return {
            content: [{ type: "text", text: `[${result.model} | ${result.routing.tier} | $${result.routing.costEstimate.toFixed(4)} | ${Math.round((result.routing.savings ?? 0) * 100)}% savings]\n\n${result.response}` }],
            structuredContent: {
              model_used: result.model,
              response: result.response,
              routing: result.routing,
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: formatError(errorMessage) }], isError: true };
        }
      }

      // Multi-turn conversation
      if (messages && messages.length > 0) {
        const targetModel = model || MODEL_TIERS[(mode ?? "balanced") as RoutingMode]?.[0] || "openai/gpt-5.4";
        const fullMessages = [
          ...(system ? [{ role: "system" as const, content: system }] : []),
          ...messages,
          { role: "user" as const, content: message },
        ];
        try {
          const result = await llm.chatCompletion(targetModel, fullMessages, {
            maxTokens: max_tokens,
            temperature,
          });
          const reply = result.choices?.[0]?.message?.content || "";
          return {
            content: [{ type: "text", text: `[${targetModel} | ${fullMessages.length} msgs]\n\n${reply}` }],
            structuredContent: { model_used: targetModel, response: reply, message_count: fullMessages.length },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return { content: [{ type: "text", text: formatError(errorMessage) }], isError: true };
        }
      }

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

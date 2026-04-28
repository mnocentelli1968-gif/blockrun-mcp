// src/tools/image.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PaymentError } from "@blockrun/llm";
import { getImageClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerImageTool(server: McpServer): void {
  server.registerTool(
    "blockrun_image",
    {
      description: `Generate or edit images via BlockRun. Pays with USDC — no separate API keys needed.

Actions:
- generate (default): Create image from text prompt
- edit: Transform an existing image using img2img

Generation models:
- zai/cogview-4 ($0.015) — Zhipu CogView-4, photorealistic, great for detailed scenes
- xai/grok-imagine-image ($0.02) — xAI Grok Imagine, stylized, fast
- xai/grok-imagine-image-pro ($0.07) — xAI Grok Imagine Pro, higher quality
- openai/gpt-image-1 ($0.02-0.04) — GPT native image generation
- openai/gpt-image-2 ($0.06-0.12) — ChatGPT Images 2.0, reasoning-driven, multilingual text rendering + character consistency
- openai/dall-e-3 ($0.04-0.08) — High quality, prompt adherence
- google/nano-banana ($0.05) — Google image model
Edit models: openai/gpt-image-1, openai/gpt-image-2 (default for edits)`,
      inputSchema: {
        prompt: z.string().describe("Image description or edit instructions"),
        action: z.enum(["generate", "edit"]).optional().default("generate").describe("generate: create from text; edit: transform existing image"),
        model: z.enum(["zai/cogview-4", "openai/dall-e-3", "together/flux-schnell", "google/nano-banana", "openai/gpt-image-1", "openai/gpt-image-2", "xai/grok-imagine-image", "xai/grok-imagine-image-pro"]).optional().describe("Model to use (default: dall-e-3 for generate, gpt-image-2 for edit). xai/grok-imagine-image is stylized and fast; xai/grok-imagine-image-pro is higher quality; gpt-image-2 is the newest edit-capable model with stronger instruction following."),
        image: z.string().optional().describe("Source image for edit action: base64-encoded image or URL"),
        size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
        quality: z.enum(["standard", "hd"]).optional().default("standard"),
      },
    },
    async ({ prompt, action, model, image, size, quality }) => {
      try {
        const imgClient = getImageClient();
        let response;

        if (action === "edit") {
          if (!image) {
            return {
              content: [{ type: "text", text: formatError("image parameter required for edit action (base64 or URL)") }],
              isError: true,
            };
          }
          response = await imgClient.edit(prompt, image, {
            model: (model || "openai/gpt-image-2") as "openai/gpt-image-1" | "openai/gpt-image-2",
            size: size as "1024x1024" | "1792x1024" | "1024x1792",
          });
        } else {
          response = await imgClient.generate(prompt, {
            model: (model || "openai/dall-e-3") as "openai/dall-e-3" | "together/flux-schnell" | "google/nano-banana" | "zai/cogview-4" | "openai/gpt-image-1" | "openai/gpt-image-2" | "xai/grok-imagine-image" | "xai/grok-imagine-image-pro",
            size: size as "1024x1024" | "1792x1024" | "1024x1792",
            quality: quality as "standard" | "hd",
          });
        }

        const imageUrl = response.data?.[0]?.url;

        if (!imageUrl) {
          return {
            content: [{ type: "text", text: formatError("No image URL in response") }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: `Image: ${imageUrl}\nPrompt: ${prompt}\nModel: ${model}` }],
          structuredContent: { url: imageUrl, prompt, model: model! },
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (err instanceof PaymentError) {
          return {
            content: [{ type: "text", text: `Image generation requires payment. Run blockrun_wallet with action: "setup" for funding instructions.\nError: ${errMsg}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: formatError(`Image generation failed: ${errMsg}`) }],
          isError: true,
        };
      }
    }
  );
}

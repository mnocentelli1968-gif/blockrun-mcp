// src/tools/image.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getImageClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerImageTool(server: McpServer): void {
  server.registerTool(
    "blockrun_image",
    {
      description: `Generate images. Models: openai/dall-e-3 ($0.04-0.08), together/flux-schnell ($0.02), google/nano-banana`,
      inputSchema: {
        prompt: z.string().describe("Image description"),
        model: z.enum(["openai/dall-e-3", "together/flux-schnell", "google/nano-banana"]).optional().default("openai/dall-e-3"),
        size: z.enum(["1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
        quality: z.enum(["standard", "hd"]).optional().default("standard"),
      },
    },
    async ({ prompt, model, size, quality }) => {
      try {
        const imgClient = getImageClient();
        const response = await imgClient.generate(prompt, {
          model: model as "openai/dall-e-3" | "together/flux-schnell" | "google/nano-banana",
          size: size as "1024x1024" | "1792x1024" | "1024x1792",
          quality: quality as "standard" | "hd",
        });

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
        if (errMsg.includes("balance") || errMsg.includes("payment") || errMsg.includes("402")) {
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

// GLM Vision tool — calls Zhipu AI API directly (requires ZHIPU_API_KEY env var)
// Based on patterns from https://github.com/zai-org/GLM-skills
// Supports: image captioning, visual grounding, document analysis, screenshot-to-code

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError } from "../utils/errors.js";

const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

type GLMVisionModel = "glm-4.6v" | "glm-4.6v-flash" | "glm-4.1v-thinking-flash";

async function callGLMVision(
  model: GLMVisionModel,
  prompt: string,
  imageUrl: string,
  thinking: boolean = false
): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY environment variable is required for GLM Vision");

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: prompt },
        ],
      },
    ],
    temperature: 0.8,
    top_p: 0.6,
    max_tokens: 16384,
    stream: false,
  };

  if (thinking || model.includes("thinking")) {
    payload["thinking"] = { type: "enabled" };
  }

  const res = await fetch(`${ZHIPU_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GLM Vision API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string }; finish_reason: string }>;
  };

  const choice = data.choices?.[0];
  if (!choice) throw new Error("No response from GLM Vision");
  if (choice.finish_reason === "sensitive") throw new Error("Content blocked by safety filter");

  return choice.message.content;
}

async function callGLMOCR(fileUrl: string, startPage = 1, endPage?: number): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY environment variable is required for GLM OCR");

  const payload: Record<string, unknown> = {
    model: "glm-ocr",
    file: fileUrl,
    return_crop_images: false,
    need_layout_visualization: false,
    start_page_id: startPage,
  };
  if (endPage) payload["end_page_id"] = endPage;

  const res = await fetch(`${ZHIPU_BASE_URL}/layout_parsing`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GLM OCR API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { markdown_result?: string; choices?: Array<{ message: { content: string } }> };
  return data.markdown_result || data.choices?.[0]?.message?.content || JSON.stringify(data);
}

async function callGLMImageGen(prompt: string, size: string, quality: string): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error("ZHIPU_API_KEY environment variable is required for GLM Image Gen");

  const res = await fetch(`${ZHIPU_BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "cogview-4-250304",
      prompt,
      size,
      quality,
      watermark_enabled: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`GLM Image API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { data?: Array<{ url: string }> };
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("No image URL in GLM response");
  return url;
}

export function registerGLMVisionTool(server: McpServer): void {
  server.registerTool(
    "blockrun_glm_vision",
    {
      description: `Analyze images and documents using Zhipu AI's GLM vision models.

Requires ZHIPU_API_KEY environment variable.

Actions:
- caption: Describe what's in an image
- analyze: Deep analysis of an image (objects, layout, text, colors)
- grounding: Locate specific elements in an image (returns bounding boxes)
- code: Generate code from a UI screenshot or mockup
- ocr: Extract text from a document/PDF (use file URL)
- imagegen: Generate an image using CogView-4

Models:
- glm-4.6v (default): Best quality vision model
- glm-4.6v-flash: Faster, cheaper
- glm-4.1v-thinking-flash: With reasoning/thinking

Cost: Zhipu AI pricing (separate from BlockRun x402 — uses ZHIPU_API_KEY)`,
      inputSchema: {
        action: z.enum(["caption", "analyze", "grounding", "code", "ocr", "imagegen"]).describe("Task to perform"),
        image: z.string().optional().describe("Image URL or base64 data URI (for vision actions)"),
        prompt: z.string().optional().describe("Custom prompt or question about the image. For imagegen: the image description"),
        model: z.enum(["glm-4.6v", "glm-4.6v-flash", "glm-4.1v-thinking-flash"]).optional().default("glm-4.6v").describe("Vision model to use"),
        size: z.enum(["1280x1280", "1280x720", "720x1280", "1024x1024"]).optional().default("1280x1280").describe("Image size (for imagegen)"),
        quality: z.enum(["hd", "standard"]).optional().default("hd").describe("Image quality (for imagegen)"),
        start_page: z.number().optional().default(1).describe("Start page for OCR (PDF)"),
        end_page: z.number().optional().describe("End page for OCR (PDF)"),
      },
    },
    async ({ action, image, prompt, model, size, quality, start_page, end_page }) => {
      try {
        if (action === "imagegen") {
          const imagePrompt = prompt || image || "";
          if (!imagePrompt) {
            return { content: [{ type: "text", text: formatError("prompt is required for imagegen action") }], isError: true };
          }
          const url = await callGLMImageGen(imagePrompt, size ?? "1280x1280", quality ?? "hd");
          return {
            content: [{ type: "text", text: `Generated image: ${url}` }],
            structuredContent: { url },
          };
        }

        if (action === "ocr") {
          const fileUrl = image || prompt;
          if (!fileUrl) {
            return { content: [{ type: "text", text: formatError("image (PDF URL) is required for OCR") }], isError: true };
          }
          const result = await callGLMOCR(fileUrl, start_page ?? 1, end_page);
          return { content: [{ type: "text", text: result }] };
        }

        // Vision actions
        if (!image) {
          return { content: [{ type: "text", text: formatError("image is required for vision actions") }], isError: true };
        }

        const actionPrompts: Record<string, string> = {
          caption: "Describe this image concisely and accurately.",
          analyze: "Analyze this image in detail: describe all visible objects, layout, colors, text, and any notable features.",
          grounding: `Locate the following elements in the image and return their bounding boxes in [x1,y1,x2,y2] format (0-1000 normalized): ${prompt || "all interactive UI elements"}`,
          code: "Generate complete, working code to replicate this UI. Use React + TypeScript + Tailwind CSS. Include all components, styling, and mock data visible in the screenshot.",
        };

        const visionPrompt = actionPrompts[action] || prompt || actionPrompts.caption;
        const result = await callGLMVision((model ?? "glm-4.6v") as GLMVisionModel, visionPrompt, image);
        return { content: [{ type: "text", text: result }] };

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: formatError(errMsg) }], isError: true };
      }
    }
  );
}

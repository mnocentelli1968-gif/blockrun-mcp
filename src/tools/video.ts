// src/tools/video.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getOrCreateWalletKey } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPaymentPayload,
  parsePaymentRequired,
  extractPaymentDetails,
} from "@blockrun/llm";

const BLOCKRUN_API = "https://blockrun.ai/api";
const VIDEO_TIMEOUT = 300_000; // 5 min — video gen + polling can take up to 3 min

export function registerVideoTool(server: McpServer): void {
  server.registerTool(
    "blockrun_video",
    {
      description: `Generate short AI videos via BlockRun x402.

Turns a text prompt (and optional seed image) into a short MP4 clip. The call blocks until the video is ready (30-120s typical; hard-capped at 85s for Seedance to stay under edge timeouts).

Models:
- xai/grok-imagine-video ($0.05/sec, 8s default -> $0.42/clip) — stylized, fast
- bytedance/seedance-1.5-pro ($0.03/sec, 720p, 5s default up to 10s) — cheapest
- bytedance/seedance-2.0-fast ($0.15/sec, ~60-80s gen) — sweet-spot price/quality
- bytedance/seedance-2.0 ($0.30/sec, 720p Pro) — highest quality

Returns a permanent blockrun-hosted MP4 URL (the gateway mirrors the asset to GCS so URLs don't expire).`,
      inputSchema: {
        prompt: z.string().describe("Text description of the video to generate. E.g. 'a red apple slowly spinning on a wooden table', 'a hummingbird hovering near a red flower, ultra slow motion'"),
        image_url: z.string().url().optional().describe("Optional seed image URL for image-to-video generation"),
        duration_seconds: z.number().int().min(1).max(60).optional().describe("Duration to bill for (defaults to the model's default — 8s for xAI, 5s for Seedance; Seedance supports up to 10s)."),
        model: z.enum(["xai/grok-imagine-video", "bytedance/seedance-1.5-pro", "bytedance/seedance-2.0-fast", "bytedance/seedance-2.0"]).optional().default("xai/grok-imagine-video").describe("Video model to use"),
      },
    },
    async ({ prompt, image_url, duration_seconds, model }) => {
      try {
        const privateKey = getOrCreateWalletKey();
        const account = privateKeyToAccount(privateKey);
        const url = `${BLOCKRUN_API}/v1/videos/generations`;

        const body: Record<string, unknown> = { model, prompt };
        if (image_url) body.image_url = image_url;
        if (duration_seconds !== undefined) body.duration_seconds = duration_seconds;

        // Step 1: get 402
        const resp402 = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, 15_000);

        if (resp402.status !== 402) {
          const data = await resp402.json() as Record<string, unknown>;
          throw new Error(`Expected 402, got ${resp402.status}: ${JSON.stringify(data)}`);
        }

        const prHeader = resp402.headers.get("payment-required") || resp402.headers.get("PAYMENT-REQUIRED");
        if (!prHeader) throw new Error("No PAYMENT-REQUIRED header in 402 response");

        const paymentRequired = parsePaymentRequired(prHeader);
        const details = extractPaymentDetails(paymentRequired);

        const paymentPayload = await createPaymentPayload(
          privateKey,
          account.address,
          details.recipient,
          details.amount,
          details.network || "eip155:8453",
          {
            resourceUrl: details.resource?.url || url,
            resourceDescription: details.resource?.description || "BlockRun Video Generation",
            maxTimeoutSeconds: details.maxTimeoutSeconds || 300,
            extra: details.extra,
          }
        );

        // Step 2: generate with payment (takes 30-120s)
        const resp = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "PAYMENT-SIGNATURE": paymentPayload,
          },
          body: JSON.stringify(body),
        }, VIDEO_TIMEOUT);

        if (resp.status === 402) {
          throw new Error("Payment rejected. Check your wallet balance.");
        }

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({ error: "Request failed" })) as Record<string, unknown>;
          throw new Error(`API error ${resp.status}: ${JSON.stringify(errBody)}`);
        }

        const data = await resp.json() as {
          data: Array<{
            url: string;
            source_url?: string;
            duration_seconds?: number;
            request_id?: string;
            backed_up?: boolean;
          }>;
          model?: string;
        };

        const clip = data.data?.[0];
        if (!clip?.url) throw new Error("No video URL in response");

        const txHash = resp.headers.get("X-Payment-Receipt") || resp.headers.get("x-payment-receipt");

        const lines = [
          `🎬 Video ready!`,
          `URL: ${clip.url}`,
          `Duration: ${clip.duration_seconds ? `${clip.duration_seconds}s` : "8s"}`,
          `Model: ${data.model || model}`,
          ...(clip.backed_up ? [`Backed up to BlockRun storage (URL is permanent)`] : clip.source_url ? [`Source URL: ${clip.source_url}`] : []),
          ...(clip.request_id ? [`Request ID: ${clip.request_id}`] : []),
          ...(txHash ? [`Tx: ${txHash}`] : []),
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: {
            url: clip.url,
            ...(clip.source_url ? { source_url: clip.source_url } : {}),
            duration_seconds: clip.duration_seconds,
            model: data.model || model,
            ...(clip.request_id ? { request_id: clip.request_id } : {}),
            ...(clip.backed_up !== undefined ? { backed_up: clip.backed_up } : {}),
            ...(txHash ? { txHash } : {}),
          },
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("balance") || errMsg.includes("payment") || errMsg.includes("402") || errMsg.includes("rejected")) {
          return {
            content: [{ type: "text", text: `Video generation requires payment. Run blockrun_wallet with action: "setup" for funding instructions.\nError: ${errMsg}` }],
            isError: true,
          };
        }
        if (errMsg.includes("abort") || errMsg.includes("timeout") || errMsg.includes("Timeout") || errMsg.includes("timed out")) {
          return {
            content: [{ type: "text", text: `Video generation timed out. The upstream async job didn't complete in time — please try again.\nError: ${errMsg}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: formatError(`Video generation failed: ${errMsg}`) }],
          isError: true,
        };
      }
    }
  );
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

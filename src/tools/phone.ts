// src/tools/phone.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient, getChain } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

type RawRequester = {
  requestWithPaymentRaw: (endpoint: string, body: unknown) => Promise<unknown>;
};

export function registerPhoneTool(server: McpServer): void {
  server.registerTool(
    "blockrun_phone",
    {
      description: `Phone number intelligence, provisioning, and outbound AI voice calls via BlockRun x402.

Pricing:
- lookup: $0.01 — carrier + line type for any number
- lookup_fraud: $0.05 — + SIM swap / call forwarding signals
- numbers_buy: $5.00 — provision a US/CA number for 30 days
- numbers_renew: $5.00 — extend lease 30 days
- numbers_list: $0.001 — list your wallet-owned numbers
- numbers_release: free — release number back to pool
- voice_call: $0.54 flat — outbound AI voice call via Bland.ai (up to 5 min default)
- voice_status: free — poll call status + transcript

Voice call flow:
  1. blockrun_phone action:"voice_call" to:"+1..." task:"Confirm appointment for..."
  2. Returns call_id immediately (call runs async)
  3. blockrun_phone action:"voice_status" call_id:"..." to poll until completed

Voice presets: nat, josh, maya, june, paige, derek, florian
Phone numbers use E.164 format: +14155552671`,
      inputSchema: {
        action: z.enum([
          "lookup", "lookup_fraud",
          "numbers_buy", "numbers_renew", "numbers_list", "numbers_release",
          "voice_call", "voice_status",
        ]).describe("Action to perform"),
        phone_number: z.string().optional().describe("E.164 phone number, e.g. +14155552671 (required for lookup, lookup_fraud, numbers_renew, numbers_release)"),
        country: z.string().optional().describe("Country for numbers_buy: US or CA (default: US)"),
        area_code: z.string().optional().describe("Preferred 3-digit area code for numbers_buy (best effort)"),
        to: z.string().optional().describe("Destination E.164 number (required for voice_call)"),
        task: z.string().optional().describe("What the AI should do on the call, 10–4000 chars (required for voice_call)"),
        from: z.string().optional().describe("Your provisioned BlockRun caller ID number (optional for voice_call)"),
        voice: z.enum(["nat", "josh", "maya", "june", "paige", "derek", "florian"]).optional().describe("AI voice preset"),
        max_duration: z.number().min(1).max(30).optional().describe("Max call duration in minutes (1–30, default: 5)"),
        language: z.string().optional().describe("Language code, e.g. en-US (default: en-US)"),
        first_sentence: z.string().optional().describe("Custom opening line for the AI agent"),
        wait_for_greeting: z.boolean().optional().describe("Wait for recipient to speak before AI starts"),
        call_id: z.string().optional().describe("Call ID from voice_call response (required for voice_status)"),
      },
    },
    async ({
      action, phone_number, country, area_code,
      to, task, from, voice, max_duration, language, first_sentence, wait_for_greeting,
      call_id,
    }) => {
      const client = getClient();
      const req = client as unknown as RawRequester;
      const chain = getChain();

      try {
        let result: unknown;

        switch (action) {
          case "lookup": {
            if (!phone_number) return { content: [{ type: "text", text: "phone_number required (E.164)" }], isError: true };
            result = await req.requestWithPaymentRaw("/v1/phone/lookup", { phoneNumber: phone_number });
            break;
          }

          case "lookup_fraud": {
            if (!phone_number) return { content: [{ type: "text", text: "phone_number required (E.164)" }], isError: true };
            result = await req.requestWithPaymentRaw("/v1/phone/lookup/fraud", { phoneNumber: phone_number });
            break;
          }

          case "numbers_buy": {
            const body: Record<string, string> = {};
            if (country) body.country = country;
            if (area_code) body.areaCode = area_code;
            result = await req.requestWithPaymentRaw("/v1/phone/numbers/buy", body);
            break;
          }

          case "numbers_renew": {
            if (!phone_number) return { content: [{ type: "text", text: "phone_number required (E.164)" }], isError: true };
            result = await req.requestWithPaymentRaw("/v1/phone/numbers/renew", { phoneNumber: phone_number });
            break;
          }

          case "numbers_list": {
            result = await req.requestWithPaymentRaw("/v1/phone/numbers/list", {});
            break;
          }

          case "numbers_release": {
            if (!phone_number) return { content: [{ type: "text", text: "phone_number required (E.164)" }], isError: true };
            result = await req.requestWithPaymentRaw("/v1/phone/numbers/release", { phoneNumber: phone_number });
            break;
          }

          case "voice_call": {
            if (!to) return { content: [{ type: "text", text: "to (destination phone number) required" }], isError: true };
            if (!task) return { content: [{ type: "text", text: "task required (what the AI should do on the call)" }], isError: true };
            const body: Record<string, unknown> = { to, task };
            if (from) body.from = from;
            if (voice) body.voice = voice;
            if (max_duration !== undefined) body.max_duration = max_duration;
            if (language) body.language = language;
            if (first_sentence) body.first_sentence = first_sentence;
            if (wait_for_greeting !== undefined) body.wait_for_greeting = wait_for_greeting;
            result = await req.requestWithPaymentRaw("/v1/voice/call", body);
            break;
          }

          case "voice_status": {
            if (!call_id) return { content: [{ type: "text", text: "call_id required" }], isError: true };
            const apiBase = chain === "solana" ? "https://sol.blockrun.ai/api" : "https://blockrun.ai/api";
            const resp = await fetch(`${apiBase}/v1/voice/call/${encodeURIComponent(call_id)}`, {
              signal: AbortSignal.timeout(15_000),
            });
            if (!resp.ok) {
              const err = await resp.text().catch(() => resp.statusText);
              return { content: [{ type: "text", text: formatError(`voice_status ${resp.status}: ${err}`) }], isError: true };
            }
            result = await resp.json();
            break;
          }
        }

        const text = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
        return {
          content: [{ type: "text", text }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (err) {
        return { content: [{ type: "text", text: formatError(err instanceof Error ? err.message : String(err)) }], isError: true };
      }
    }
  );
}

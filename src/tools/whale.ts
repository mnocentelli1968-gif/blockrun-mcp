// src/tools/whale.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KNOWN_LABELS } from "../utils/constants.js";

function getAddressLabel(address: string): string {
  const lower = address.toLowerCase();
  return KNOWN_LABELS[lower] || shortenAddress(address);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function registerWhaleTool(server: McpServer): void {
  server.registerTool(
    "blockrun_whale",
    {
      description: `Track large ETH transfers (whale movements). Uses BigQuery public data.

Shows:
- Large transfers (100+ ETH)
- Exchange inflows/outflows
- Labels for known addresses (Binance, Coinbase, etc.)

Note: Requires GOOGLE_APPLICATION_CREDENTIALS env var for BigQuery auth.
For MVP/demo: Returns simulated data if BigQuery not configured.`,
      inputSchema: {
        hours: z.number().optional().default(24).describe("Hours to look back (default: 24)"),
        min_eth: z.number().optional().default(100).describe("Minimum ETH amount (default: 100)"),
        limit: z.number().optional().default(20).describe("Max results (default: 20)"),
      },
    },
    async ({ hours, min_eth, limit }) => {
      // Check if BigQuery is configured
      const hasGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT;

      if (!hasGoogleCreds) {
        // Return demo data for showcase
        const demoData = [
          { from: "0xf977814e90da44bfa03b6295a0616a897441acec", to: "0x28c6c06298d514db089934071355e5743bf21d60", value: 5000, time: "2h ago" },
          { from: "0x503828976d22510aad0201ac7ec88293211d23da", to: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503", value: 3200, time: "4h ago" },
          { from: "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b", to: "0xd24400ae8bfebb18ca49be86258a3c749cf46853", value: 2100, time: "6h ago" },
          { from: "0x1062a747393198f70f71ec65a582423dba7e5ab3", to: "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1", value: 1800, time: "8h ago" },
          { from: "0x75e89d5979e4f6fba9f97c104c2f0afb3f1dcb88", to: "0xa3a7b6f88361f48403514059f1f16c8e78d60eec", value: 1500, time: "12h ago" },
        ];

        const lines = demoData.map(t => {
          const fromLabel = getAddressLabel(t.from);
          const toLabel = getAddressLabel(t.to);
          return `${t.value.toLocaleString()} ETH | ${fromLabel} → ${toLabel} | ${t.time}`;
        });

        return {
          content: [{
            type: "text",
            text: `[Whale Tracker - DEMO MODE]
⚠️ BigQuery not configured. Showing sample data.

To enable real data:
1. Create GCP project: console.cloud.google.com
2. Enable BigQuery API
3. Set GOOGLE_APPLICATION_CREDENTIALS env var

Sample whale movements:
${lines.join("\n")}

Total: ${demoData.reduce((s, t) => s + t.value, 0).toLocaleString()} ETH across ${demoData.length} transfers`,
          }],
          structuredContent: { demo: true, transfers: demoData },
        };
      }

      // Real BigQuery integration would go here
      // For now, return instructions
      return {
        content: [{
          type: "text",
          text: `[Whale Tracker]

BigQuery credentials detected. Real-time query:
- Looking back: ${hours}h
- Min transfer: ${min_eth} ETH
- Limit: ${limit} results

Query would run:
SELECT block_timestamp, from_address, to_address, value/1e18 as eth
FROM \`bigquery-public-data.crypto_ethereum.transactions\`
WHERE value > ${min_eth} * 1e18
  AND block_timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${hours} HOUR)
ORDER BY value DESC
LIMIT ${limit}

Note: Full BigQuery integration coming soon.`,
        }],
      };
    }
  );
}

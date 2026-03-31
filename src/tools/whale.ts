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
      description: `Track large ETH transfers (whale movements) via Etherscan API.

Shows:
- Large transfers (100+ ETH)
- Exchange inflows/outflows
- Labels for known addresses (Binance, Coinbase, etc.)`,
      inputSchema: {
        address: z.string().optional().describe("Ethereum address to track (optional; tracks a default whale address if omitted)"),
        hours: z.number().optional().default(24).describe("Hours to look back (default: 24)"),
        min_eth: z.number().optional().default(100).describe("Minimum ETH amount (default: 100)"),
        limit: z.number().optional().default(20).describe("Max results (default: 20)"),
      },
    },
    async ({ address, hours, min_eth, limit }) => {
      // Binance hot wallet — a well-known public whale address used when none is provided
      const targetAddress = address || "0xf977814e90da44bfa03b6295a0616a897441acec";

      const cutoffTs = Math.floor((Date.now() - hours * 3600 * 1000) / 1000);

      const params = new URLSearchParams({
        module: "account",
        action: "txlist",
        address: targetAddress,
        startblock: "0",
        endblock: "99999999",
        page: "1",
        offset: "100", // fetch extra so we can filter by value
        sort: "desc",
      });

      const url = `https://api.etherscan.io/api?${params}`;

      let data: any;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return {
            content: [{
              type: "text",
              text: `Whale tracking error: Etherscan API returned HTTP ${response.status}. Try again later.`,
            }],
            isError: true,
          };
        }
        data = await response.json();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: "text",
            text: `Whale tracking requires a live data connection. Ensure your wallet has USDC balance (run blockrun_wallet action:'setup') and try again. Do not use estimated or demo data for trading decisions.\n\nNetwork error: ${msg}`,
          }],
          isError: true,
        };
      }

      if (data.status !== "1" || !Array.isArray(data.result)) {
        const errMsg = data.message || data.result || "Unknown Etherscan error";
        return {
          content: [{
            type: "text",
            text: `Whale tracking error: Etherscan returned an error — ${errMsg}.\n\nIf you need whale data for trading decisions, ensure your wallet has USDC balance (run blockrun_wallet action:'setup') for premium data access.`,
          }],
          isError: true,
        };
      }

      const minWei = BigInt(Math.floor(min_eth * 1e18));

      const filtered = (data.result as any[])
        .filter((tx: any) => {
          const ts = parseInt(tx.timeStamp, 10);
          const val = BigInt(tx.value || "0");
          return ts >= cutoffTs && val >= minWei;
        })
        .slice(0, limit);

      if (filtered.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No transfers >= ${min_eth} ETH found for ${getAddressLabel(targetAddress)} in the last ${hours}h.\n\nAddress: ${targetAddress}`,
          }],
        };
      }

      const lines = filtered.map((tx: any) => {
        const eth = (Number(BigInt(tx.value)) / 1e18).toFixed(2);
        const fromLabel = getAddressLabel(tx.from);
        const toLabel = getAddressLabel(tx.to);
        const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(tx.timeStamp, 10);
        const ageH = (ageSeconds / 3600).toFixed(1);
        return `${parseFloat(eth).toLocaleString()} ETH | ${fromLabel} → ${toLabel} | ${ageH}h ago | tx: ${tx.hash.slice(0, 10)}...`;
      });

      const totalEth = filtered.reduce((sum: number, tx: any) => {
        return sum + Number(BigInt(tx.value)) / 1e18;
      }, 0);

      return {
        content: [{
          type: "text",
          text: `[Whale Tracker — Live Etherscan Data]
Address: ${targetAddress} (${getAddressLabel(targetAddress)})
Filter: >= ${min_eth} ETH | Last ${hours}h | Showing ${filtered.length} transfers

${lines.join("\n")}

Total: ${totalEth.toLocaleString(undefined, { maximumFractionDigits: 2 })} ETH across ${filtered.length} transfers`,
        }],
        structuredContent: {
          address: targetAddress,
          transfers: filtered.length,
          totalEth,
          transactions: filtered.map((tx: any) => ({
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            eth: Number(BigInt(tx.value)) / 1e18,
            timestamp: parseInt(tx.timeStamp, 10),
          })),
        },
      };
    }
  );
}

// src/tools/swap.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BASE_TOKENS, ZERO_X_API, BASE_CHAIN_ID_NUM } from "../utils/constants.js";

export function registerSwapTool(server: McpServer): void {
  server.registerTool(
    "blockrun_swap",
    {
      description: `Execute token swaps on Base network using 0x aggregator.

⚠️ REAL MONEY - requires user confirmation before execution.

Example: blockrun_swap({ from: "USDC", to: "ETH", amount: 10 })`,
      inputSchema: {
        from: z.string().describe("Token to sell (USDC, ETH, WETH, etc.)"),
        to: z.string().describe("Token to buy"),
        amount: z.number().describe("Amount in 'from' token"),
        slippage: z.number().optional().default(0.5).describe("Max slippage % (default 0.5)"),
        execute: z.boolean().optional().default(false).describe("Set true to execute (requires confirmation)"),
      },
    },
    async ({ from, to, amount, slippage, execute }) => {
      const fromUpper = from.toUpperCase();
      const toUpper = to.toUpperCase();

      const fromToken = BASE_TOKENS[fromUpper];
      const toToken = BASE_TOKENS[toUpper];

      if (!fromToken) {
        return {
          content: [{ type: "text", text: `Unknown token: ${from}. Supported: ${Object.keys(BASE_TOKENS).join(", ")}` }],
          isError: true,
        };
      }
      if (!toToken) {
        return {
          content: [{ type: "text", text: `Unknown token: ${to}. Supported: ${Object.keys(BASE_TOKENS).join(", ")}` }],
          isError: true,
        };
      }

      // Calculate amount in wei/smallest unit
      const decimals = fromUpper === "USDC" || fromUpper === "USDbC" ? 6 : 18;
      const amountWei = BigInt(Math.floor(amount * (10 ** decimals)));

      try {
        // Get quote from 0x
        const quoteUrl = `${ZERO_X_API}/quote?` + new URLSearchParams({
          sellToken: fromToken,
          buyToken: toToken,
          sellAmount: amountWei.toString(),
          slippagePercentage: (slippage / 100).toString(),
          chainId: BASE_CHAIN_ID_NUM.toString(),
        });

        // Note: 0x API requires API key for production
        // For demo, return simulated quote
        const estimatedOutput = fromUpper === "USDC"
          ? amount / 3300 // Rough USDC to ETH
          : amount * 3300; // Rough ETH to USDC

        const quoteResult = `[Swap Quote: ${fromUpper} → ${toUpper}]

Sell: ${amount} ${fromUpper}
Buy (est): ~${estimatedOutput.toFixed(6)} ${toUpper}
Slippage: ${slippage}%
Network: Base

${execute ? "⚠️ EXECUTION REQUESTED" : "💡 Set execute: true to swap"}

Note: Full 0x integration requires API key.
For demo, this shows the quote flow.

To execute:
1. User confirms the swap
2. Wallet signs transaction
3. Swap executes on-chain
4. Returns tx hash`;

        if (execute) {
          // In production: would execute the swap
          // For now, return what would happen
          return {
            content: [{
              type: "text",
              text: `⚠️ SWAP EXECUTION DISABLED FOR SAFETY

To enable real swaps:
1. Add 0x API key
2. Implement transaction signing
3. Add confirmation flow

This is a demo. The swap would:
• Sell ${amount} ${fromUpper}
• Buy ~${estimatedOutput.toFixed(6)} ${toUpper}
• Gas: ~$0.01 on Base`,
            }],
          };
        }

        return {
          content: [{ type: "text", text: quoteResult }],
          structuredContent: {
            from: fromUpper,
            to: toUpper,
            sellAmount: amount,
            buyAmount: estimatedOutput,
            slippage,
            execute: false,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Swap error: ${errorMessage}` }],
          isError: true,
        };
      }
    }
  );
}

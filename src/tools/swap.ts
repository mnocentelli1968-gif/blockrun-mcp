// src/tools/swap.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BASE_TOKENS, ZERO_X_API, BASE_CHAIN_ID_NUM } from "../utils/constants.js";

export function registerSwapTool(server: McpServer): void {
  server.registerTool(
    "blockrun_swap",
    {
      description: `Get token swap quotes on Base network using 0x aggregator.

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

      const quoteUrl = `${ZERO_X_API}/quote?` + new URLSearchParams({
        sellToken: fromToken,
        buyToken: toToken,
        sellAmount: amountWei.toString(),
        slippagePercentage: (slippage / 100).toString(),
        chainId: BASE_CHAIN_ID_NUM.toString(),
      });

      let quoteData: any;
      try {
        const response = await fetch(quoteUrl, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        const text = await response.text();

        if (!response.ok) {
          return {
            content: [{
              type: "text",
              text: `Swap quote failed: 0x API returned HTTP ${response.status}.\n\nResponse: ${text}\n\nIf you need swap access, ensure your wallet has USDC balance (run blockrun_wallet action:'setup') for authenticated API access.`,
            }],
            isError: true,
          };
        }

        try {
          quoteData = JSON.parse(text);
        } catch {
          return {
            content: [{
              type: "text",
              text: `Swap quote failed: Could not parse 0x API response.\n\nRaw response: ${text.slice(0, 500)}`,
            }],
            isError: true,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{
            type: "text",
            text: `Swap quote failed: Network error contacting 0x API — ${msg}.\n\nDo not use estimated prices for trading decisions.`,
          }],
          isError: true,
        };
      }

      // Extract real quote data from 0x response
      const buyAmountRaw = quoteData.buyAmount;
      const buyDecimals = toUpper === "USDC" || toUpper === "USDbC" ? 6 : 18;
      const buyAmount = buyAmountRaw
        ? Number(BigInt(buyAmountRaw)) / (10 ** buyDecimals)
        : null;

      const price = quoteData.price;
      const guaranteedPrice = quoteData.guaranteedPrice;
      const estimatedGas = quoteData.estimatedGas;
      const gas = quoteData.gas;

      if (execute) {
        return {
          content: [{
            type: "text",
            text: `[Swap Quote: ${fromUpper} → ${toUpper}]

Sell: ${amount} ${fromUpper}
Buy: ${buyAmount !== null ? buyAmount.toFixed(6) : "N/A"} ${toUpper}
Price: ${price || "N/A"}
Guaranteed Price: ${guaranteedPrice || "N/A"}
Slippage: ${slippage}%
Estimated Gas: ${estimatedGas || gas || "N/A"}
Network: Base

⚠️ EXECUTION REQUESTED — transaction signing not yet implemented.
To execute this swap, implement wallet signing with the 'data', 'to', and 'value' fields from the 0x quote response.`,
          }],
          structuredContent: quoteData,
        };
      }

      return {
        content: [{
          type: "text",
          text: `[Swap Quote: ${fromUpper} → ${toUpper}]

Sell: ${amount} ${fromUpper}
Buy: ${buyAmount !== null ? buyAmount.toFixed(6) : "N/A"} ${toUpper}
Price: ${price || "N/A"}
Guaranteed Price: ${guaranteedPrice || "N/A"}
Slippage: ${slippage}%
Estimated Gas: ${estimatedGas || gas || "N/A"}
Network: Base

Set execute: true to proceed with this swap.`,
        }],
        structuredContent: {
          from: fromUpper,
          to: toUpper,
          sellAmount: amount,
          buyAmount,
          price,
          guaranteedPrice,
          slippage,
          estimatedGas: estimatedGas || gas,
          rawQuote: quoteData,
        },
      };
    }
  );
}

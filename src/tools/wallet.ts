// src/tools/wallet.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BudgetState } from "../types.js";
import { getWalletInfo, getUsdcBalance } from "../utils/wallet.js";
import { generateQrPng, openQrInViewer } from "../utils/qr.js";

export function registerWalletTool(server: McpServer, budget: BudgetState): void {
  server.registerTool(
    "blockrun_wallet",
    {
      description: `Manage your BlockRun wallet - check status, get funding instructions, open QR code, or manage session budget.

Actions:
- status: Show wallet address, balance, and basescan link (default)
- setup: Full funding instructions with QR code
- qr: Generate and open QR code for easy funding
- budget: Manage session spending limit

Examples:
  blockrun_wallet()                                    -> status + balance
  blockrun_wallet({ action: "setup" })                 -> funding instructions + QR
  blockrun_wallet({ action: "qr" })                    -> open QR code
  blockrun_wallet({ action: "budget", budget_action: "set", budget_amount: 1.00 })`,
      inputSchema: {
        action: z.enum(["status", "setup", "qr", "budget"]).optional().default("status").describe("What to do"),
        budget_action: z.enum(["set", "check", "clear"]).optional().describe("Budget action (for action='budget')"),
        budget_amount: z.number().optional().describe("Budget limit in USD (for budget_action='set')"),
      },
    },
    async ({ action, budget_action, budget_amount }) => {
      const info = getWalletInfo();
      const address = info.address;

      // Handle budget action
      if (action === "budget") {
        const budgetAct = budget_action || "check";

        if (budgetAct === "set") {
          if (budget_amount === undefined || budget_amount <= 0) {
            return {
              content: [{ type: "text", text: "Error: Provide a positive budget_amount (e.g., 1.00 for $1.00)" }],
              isError: true,
            };
          }
          budget.limit = budget_amount;
        } else if (budgetAct === "clear") {
          budget.limit = null;
        }

        const remaining = budget.limit !== null ? budget.limit - budget.spent : null;
        const limitStr = budget.limit !== null ? `$${budget.limit.toFixed(2)}` : "Unlimited";
        const remainingStr = remaining !== null ? `$${remaining.toFixed(4)}` : "N/A";

        return {
          content: [{ type: "text", text: `Session Budget: ${limitStr} | Spent: $${budget.spent.toFixed(4)} | Calls: ${budget.calls} | Remaining: ${remainingStr}${budgetAct === "set" ? ` | Set to $${budget_amount?.toFixed(2)}` : ""}${budgetAct === "clear" ? " | Limit removed" : ""}` }],
          structuredContent: {
            limit: budget.limit,
            spent: budget.spent,
            calls: budget.calls,
            remaining,
          },
        };
      }

      // Handle QR action
      if (action === "qr") {
        try {
          const qrPath = await generateQrPng(address);
          await openQrInViewer(qrPath);
          return {
            content: [{ type: "text", text: `QR code opened! Scan with MetaMask to send USDC on Base.\n\nAddress: ${address}\nQR saved: ${qrPath}` }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Failed to generate QR: ${err}` }],
            isError: true,
          };
        }
      }

      // Handle setup action
      if (action === "setup") {
        // Generate and open QR
        let qrMessage = "";
        try {
          const qrPath = await generateQrPng(address);
          await openQrInViewer(qrPath);
          qrMessage = `\nQR code opened for scanning! (${qrPath})`;
        } catch {
          qrMessage = "\n(QR generation failed - use address above)";
        }

        const text = `
================================================================================
                        BLOCKRUN WALLET SETUP
================================================================================

Your wallet address: ${address}
${qrMessage}

HOW TO FUND YOUR WALLET:
------------------------

Option 1: Transfer from Coinbase
  1. Open Coinbase app or website
  2. Go to Send/Receive -> Select USDC
  3. Choose "Base" network (important!)
  4. Paste: ${address}
  5. Send $1-5 to start

Option 2: Bridge from other chains
  https://bridge.base.org -> Bridge USDC to Base -> Send to address above

Option 3: Buy directly
  https://www.coinbase.com/onramp -> Buy USDC on Base -> Send to address above

VERIFY BALANCE: https://basescan.org/address/${address}

PRICING (pay per use):
  - GPT-4o: ~$0.005/request | Claude Sonnet: ~$0.003/request
  - Gemini Flash: ~$0.0001/request | Full pricing: https://blockrun.ai/pricing

SECURITY: Private key stored at ~/.blockrun/.session (never leaves your machine)
================================================================================`;

        return { content: [{ type: "text", text }] };
      }

      // Default: status action
      const balance = await getUsdcBalance(address);
      const balanceStr = balance !== null ? `$${balance.toFixed(6)} USDC` : "Unable to fetch";
      const lowBalance = balance !== null && balance < 1;

      const text = `Wallet: ${address}
Balance: ${balanceStr}${lowBalance ? " (low - add funds)" : ""}
Network: Base | View: ${info.basescanUrl}
${info.isNew ? "\nNEW WALLET - Run with action: 'setup' for funding instructions" : ""}`;

      return {
        content: [{ type: "text", text }],
        structuredContent: {
          address: info.address,
          balance,
          network: info.network,
          chainId: info.chainId,
          isNew: info.isNew,
          basescanUrl: info.basescanUrl,
        },
      };
    }
  );
}

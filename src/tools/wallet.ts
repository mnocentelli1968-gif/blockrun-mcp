// src/tools/wallet.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BudgetState } from "../types.js";
import { getWalletInfo, getUsdcBalance } from "../utils/wallet.js";
import { generateQrPng, openQrInViewer } from "../utils/qr.js";
import { formatError } from "../utils/errors.js";

export function registerWalletTool(server: McpServer, budget: BudgetState): void {
  server.registerTool(
    "blockrun_wallet",
    {
      description: `Manage your BlockRun wallet - check status, get funding instructions, open QR code, manage session budget, or orchestrate multi-agent sub-budgets.

Actions:
- status: Show wallet address, balance, and basescan link (default)
- setup: Full funding instructions with QR code
- qr: Generate and open QR code for easy funding
- budget: Manage session spending limit
- delegate: Allocate a sub-budget to a named child agent (requires agent_id, agent_limit)
- revoke: Remove a child agent's budget allocation (requires agent_id)
- report: Show global and per-agent spending breakdown

Examples:
  blockrun_wallet()                                    -> status + balance
  blockrun_wallet({ action: "setup" })                 -> funding instructions + QR
  blockrun_wallet({ action: "qr" })                    -> open QR code
  blockrun_wallet({ action: "budget", budget_action: "set", budget_amount: 1.00 })
  blockrun_wallet({ action: "delegate", agent_id: "researcher", agent_limit: 0.50 })
  blockrun_wallet({ action: "revoke", agent_id: "researcher" })
  blockrun_wallet({ action: "report" })`,
      inputSchema: {
        action: z.enum(["status", "setup", "qr", "budget", "delegate", "revoke", "report"]).optional().default("status").describe("What to do"),
        budget_action: z.enum(["set", "check", "clear"]).optional().describe("Budget action (for action='budget')"),
        budget_amount: z.number().optional().describe("Budget limit in USD (for budget_action='set')"),
        agent_id: z.string().optional().describe("Agent identifier for delegate/revoke/report actions"),
        agent_limit: z.number().optional().describe("Budget limit in USD for this agent (required for delegate action)"),
      },
    },
    async ({ action, budget_action, budget_amount, agent_id, agent_limit }) => {
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

      // Delegate: allocate budget to a named agent
      if (action === "delegate") {
        if (!agent_id) {
          return { content: [{ type: "text", text: formatError("agent_id required for delegate action") }], isError: true };
        }
        if (!agent_limit || agent_limit <= 0) {
          return { content: [{ type: "text", text: formatError("agent_limit (USD > 0) required for delegate action") }], isError: true };
        }
        budget.agents.set(agent_id, { limit: agent_limit, spent: 0, calls: 0 });
        return {
          content: [{ type: "text", text: `Agent "${agent_id}" allocated $${agent_limit.toFixed(2)} budget.\nPass agent_id: "${agent_id}" in any blockrun_* tool call to track and enforce this limit.` }],
          structuredContent: { agent_id, limit: agent_limit, spent: 0, calls: 0 },
        };
      }

      // Revoke: remove an agent's budget allocation
      if (action === "revoke") {
        if (!agent_id) {
          return { content: [{ type: "text", text: formatError("agent_id required for revoke action") }], isError: true };
        }
        const existed = budget.agents.has(agent_id);
        budget.agents.delete(agent_id);
        return {
          content: [{ type: "text", text: existed ? `Agent "${agent_id}" budget revoked.` : `Agent "${agent_id}" had no budget entry.` }],
          structuredContent: { agent_id, revoked: existed },
        };
      }

      // Report: show spending breakdown by agent
      if (action === "report") {
        const agentRows: Record<string, { limit: number; spent: number; calls: number; remaining: number }> = {};
        for (const [id, ab] of budget.agents.entries()) {
          agentRows[id] = {
            limit: ab.limit,
            spent: ab.spent,
            calls: ab.calls,
            remaining: Math.max(0, ab.limit - ab.spent),
          };
        }
        const agentLines = Object.entries(agentRows).map(
          ([id, ab]) => `  ${id}: $${ab.spent.toFixed(4)}/$${ab.limit.toFixed(2)} (${ab.calls} calls, $${ab.remaining.toFixed(4)} remaining)`
        );
        const lines = [
          `Global: $${budget.spent.toFixed(4)} spent${budget.limit ? ` / $${budget.limit.toFixed(2)} limit` : " (no limit)"} — ${budget.calls} calls`,
          ``,
          `Per-agent budgets (${budget.agents.size} active):`,
          ...(agentLines.length > 0 ? agentLines : ["  (none delegated)"]),
        ];
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: { global: { limit: budget.limit, spent: budget.spent, calls: budget.calls }, agents: agentRows },
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

// src/utils/budget.ts
import type { BudgetState } from "../types.js";

export function checkBudget(budget: BudgetState, agentId?: string): { allowed: boolean; reason?: string } {
  // Check global limit first
  if (budget.limit !== null && budget.spent >= budget.limit) {
    return {
      allowed: false,
      reason: `Global budget limit $${budget.limit.toFixed(2)} reached ($${budget.spent.toFixed(4)} spent)`,
    };
  }

  // Check per-agent limit
  if (agentId) {
    const agentBudget = budget.agents.get(agentId);
    if (agentBudget && agentBudget.spent >= agentBudget.limit) {
      return {
        allowed: false,
        reason: `Agent "${agentId}" budget $${agentBudget.limit.toFixed(2)} exhausted ($${agentBudget.spent.toFixed(4)} spent in ${agentBudget.calls} calls)`,
      };
    }
  }

  return { allowed: true };
}

export function recordSpending(budget: BudgetState, cost: number, agentId?: string): void {
  budget.spent += cost;
  budget.calls += 1;

  if (agentId) {
    const agentBudget = budget.agents.get(agentId);
    if (agentBudget) {
      agentBudget.spent += cost;
      agentBudget.calls += 1;
    }
    // If no budget entry for this agent, spending is tracked globally only
  }
}

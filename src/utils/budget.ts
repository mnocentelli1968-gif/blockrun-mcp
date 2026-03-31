import type { BudgetState } from "../types.js";

export function recordSpending(budget: BudgetState, cost: number): void {
  budget.spent += cost;
  budget.calls += 1;
}

export function checkBudget(budget: BudgetState): { allowed: boolean; remaining: number | null } {
  if (budget.limit === null) {
    return { allowed: true, remaining: null };
  }
  const remaining = budget.limit - budget.spent;
  return { allowed: remaining > 0, remaining };
}

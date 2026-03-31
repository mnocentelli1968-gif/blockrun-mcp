import type { LLMClient, ImageClient, Model } from "@blockrun/llm";

export interface BudgetState {
  limit: number | null;
  spent: number;
  calls: number;
}

export interface ServerContext {
  getClient: () => LLMClient;
  getImageClient: () => ImageClient;
  getCachedModels: () => Model[] | null;
  setCachedModels: (models: Model[] | null) => void;
  budget: BudgetState;
  getWalletAddress: () => string;
  isWalletNew: () => boolean;
}

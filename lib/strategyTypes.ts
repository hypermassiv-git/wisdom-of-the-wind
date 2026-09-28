import type { StrategyType } from "@/lib/engine/types";

/** Beginner-friendly name for each strategy type, shared by cards and filters. */
export const TYPE_LABEL: Record<StrategyType, string> = {
  simpleDeposit: "Just deposit",
  yieldLoop: "Yield loop",
  marketGap: "Rate gap between markets",
  stableCarry: "Stablecoin swap",
  collateralCarry: "Borrow against your assets",
};

/** Shorter names for filter chips, in display order. */
export const TYPE_FILTERS: [StrategyType, string][] = [
  ["simpleDeposit", "Just deposit"],
  ["yieldLoop", "Loops"],
  ["marketGap", "Rate gaps"],
  ["stableCarry", "Stablecoin swaps"],
  ["collateralCarry", "Borrow against assets"],
];

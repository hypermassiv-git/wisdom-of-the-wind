/** Strategy engine settings. All tunable knobs live here. */

export interface EngineConfig {
  /** Only show strategies whose net yearly rate beats this (0.01 = 1%). */
  minNetApr: number;
  /** Borrow this share of the maximum allowed (0.5 = half of max). */
  leverageFraction: number;
  /** Amount the card numbers are quoted for, in USD. */
  principalUsd: number;
  /**
   * How much each reward token counted in dollars is worth relative to its market price.
   * MON incentives (paid via Merkl) count at full price.
   */
  rewardValuation: Record<string, number>;
  /**
   * Reward tokens you build up and hold rather than spend: shown as token amounts, never in dollars,
   * and left out of totals and ranking. DUST locks into veDUST for a cut of Neverland's revenue and a vote.
   */
  heldRewards: string[];
  /** Skip borrow markets with less spare cash than this (USD). */
  minLiquidityUsd: number;
  /** Maximum number of cards to show. */
  maxResults: number;
}

export const ENGINE_CONFIG: EngineConfig = {
  minNetApr: 0.01,
  leverageFraction: 0.5,
  principalUsd: 1000,
  rewardValuation: { MON: 1.0 },
  heldRewards: ["DUST"],
  minLiquidityUsd: 10_000,
  maxResults: 20,
};

/**
 * Risk scoring, aimed at the chance of liquidation or losing access to funds.
 * Low ≤ 1 point, Medium = 2, High ≥ 3.
 *
 * Liquidation depends on the deposit's price *relative to the loan*. When both track the same
 * underlying asset (shMON or PT-shMON against MON, stablecoins against stablecoins), a market-wide
 * price move shifts both together, so those pairs add no price points.
 */
export const RISK_POINTS = {
  base: 0,
  /** Deposit and loan are different kinds of asset (e.g. BTC against dollars). */
  priceExposure: 2,
  /** Loops repeat the borrowing, so gains and losses are multiplied. */
  loop: 1,
  /** Lending into an isolated market where others borrow it: cash can be briefly tied up. */
  isolatedLend: 1,
  /** Earnings depend on reward rates staying about where they are. */
  rewardDriven: 1,
};

export const RISK_THRESHOLDS = { low: 1, medium: 2 } as const;

export function getDataMode(): "mock" | "live" {
  return process.env.DATA_MODE === "live" ? "live" : "mock";
}

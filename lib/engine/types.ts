import type { RiskFactor } from "./risks";
import type { Incentive, Market, Reserve } from "@/lib/data/types";

export type StrategyType = "simpleDeposit" | "yieldLoop" | "marketGap" | "stableCarry" | "collateralCarry";
export type RiskLevel = "Low" | "Medium" | "High";

export interface Leg {
  role: "deposit" | "borrow" | "lend";
  symbol: string;
  marketId: string;
  marketName: string;
  marketKind: Market["kind"];
  /** USD amount in this leg, for the configured principal. */
  amountUsd: number;
  /** Base yearly rate from the market (supply rate, or borrow rate for borrows). */
  baseRate: number;
  /** Asset's own yield (staking, PT, vault). Zero for borrows. */
  builtInRate: number;
  incentives: Incentive[];
}

export interface Earnings {
  /** Yearly USD from base rates and built-in yields (can be negative). */
  interest: number;
  /** Yearly USD from reward tokens. */
  rewards: number;
  net: number;
  rewardsByToken: Record<string, number>;
  /** Held reward tokens (DUST), as dollar-equivalents for conversion only; not in `rewards` or `net`. */
  heldByToken: Record<string, number>;
}

/** What a generator produces, before risk and wording are added. */
export interface Candidate {
  type: StrategyType;
  legs: Leg[];
  /** Deposit ÷ debt, weighted by liquidation threshold. Above 1 is safe; lower is riskier. */
  safetyScore: number;
  /** Symbols used for wording. */
  vars: {
    deposit: string;
    borrow?: string;
    lend?: string;
    depositMarket: string;
    borrowMarket: string;
    lendMarket?: string;
    maturity?: string;
  };
}

export interface StrategyText {
  name: string;
  action: string;
  whyNow: string;
  mainRisk: string;
}

export interface Strategy extends Candidate {
  id: string;
  earnings: Earnings;
  /** Earnings of the borrowed part alone (excludes what your own deposit earns). */
  spread: Earnings;
  /** Net yearly rate on the principal (0.05 = 5%). */
  netApr: number;
  rewardDriven: boolean;
  risk: RiskLevel;
  riskReasons: string[];
  /** Structured risks for icons/chips; the first is the main one. */
  riskFactors: RiskFactor[];
  text: StrategyText;
  /** Market price of each held reward token, to show it as a token amount (e.g. 430 DUST). */
  heldPriceUsd: Record<string, number>;
}

export interface MarketReserve {
  market: Market;
  reserve: Reserve;
}

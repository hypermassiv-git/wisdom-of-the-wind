/** Pure position math. No I/O, no config imports — everything is passed in. */
import type { Market, Reserve } from "@/lib/data/types";
import type { Earnings, Leg } from "./types";

export interface Limits {
  ltv: number;
  liquidationThreshold: number;
}

/**
 * Borrow limits for using `collateral` to borrow `debt` in `market`.
 * Uses the efficiency-mode limits when both share a category.
 */
export function effectiveLimits(market: Market, collateral: Reserve, debt: Reserve): Limits {
  if (collateral.eModeId !== undefined && collateral.eModeId === debt.eModeId) {
    const e = market.eModes.find((m) => m.id === collateral.eModeId);
    if (e) return { ltv: e.ltv, liquidationThreshold: e.liquidationThreshold };
  }
  return { ltv: collateral.ltv, liquidationThreshold: collateral.liquidationThreshold };
}

/** Share of the deposit that gets borrowed: max LTV scaled down to be conservative. */
export function borrowFraction(ltv: number, leverageFraction: number): number {
  return Math.max(0, Math.min(ltv * leverageFraction, 0.95));
}

/**
 * Loop sizing: deposit, borrow b of it, redeposit, repeat forever.
 * Geometric series → total deposit = principal / (1 − b).
 */
export function loopSizes(principal: number, b: number): { supplied: number; borrowed: number } {
  const supplied = principal / (1 - b);
  return { supplied, borrowed: supplied - principal };
}

/** Carry sizing: deposit the principal once, borrow b of it. */
export function carrySizes(principal: number, b: number): { deposited: number; borrowed: number } {
  return { deposited: principal, borrowed: principal * b };
}

/** Liquidation-threshold-weighted deposit ÷ debt. */
export function safetyScore(depositUsd: number, liquidationThreshold: number, debtUsd: number): number {
  if (debtUsd <= 0) return Infinity;
  return (depositUsd * liquidationThreshold) / debtUsd;
}

/** Yearly USD earnings of one leg, split into interest and rewards per token. */
export function legEarnings(
  leg: Leg,
  rewardValuation: Record<string, number>,
): { interest: number; rewardsByToken: Record<string, number> } {
  const sign = leg.role === "borrow" ? -1 : 1;
  const interest = sign * leg.amountUsd * leg.baseRate + (leg.role === "borrow" ? 0 : leg.amountUsd * leg.builtInRate);
  const rewardsByToken: Record<string, number> = {};
  for (const inc of leg.incentives) {
    const factor = rewardValuation[inc.token] ?? 1;
    rewardsByToken[inc.token] = (rewardsByToken[inc.token] ?? 0) + leg.amountUsd * inc.apr * factor;
  }
  return { interest, rewardsByToken };
}

export function positionEarnings(legs: Leg[], rewardValuation: Record<string, number>): Earnings {
  let interest = 0;
  const rewardsByToken: Record<string, number> = {};
  for (const leg of legs) {
    const e = legEarnings(leg, rewardValuation);
    interest += e.interest;
    for (const [t, v] of Object.entries(e.rewardsByToken)) rewardsByToken[t] = (rewardsByToken[t] ?? 0) + v;
  }
  const rewards = Object.values(rewardsByToken).reduce((a, b) => a + b, 0);
  return { interest, rewards, net: interest + rewards, rewardsByToken };
}

/**
 * Earnings from the borrowed part only: the loan plus whatever it pays for.
 * Your own starting deposit is excluded, so this shows whether borrowing is worth it.
 */
export function spreadEarnings(
  legs: Leg[],
  principal: number,
  rewardValuation: Record<string, number>,
): Earnings {
  const spreadLegs = legs.map((l) =>
    l.role === "deposit" ? { ...l, amountUsd: Math.max(0, l.amountUsd - principal) } : l,
  );
  return positionEarnings(spreadLegs, rewardValuation);
}

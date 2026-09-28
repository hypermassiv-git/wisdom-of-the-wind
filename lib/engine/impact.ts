/**
 * Prices in the user's own deposit and loan. Aave rates depend on utilization (borrowed ÷ deposited),
 * so depositing lowers a pool's rates and borrowing raises them, sharply past the "kink".
 * Reward rates are shared out over the pool, so adding to it dilutes them.
 */
import { aprToApy } from "@/lib/data/rates";
import type { MarketSnapshot, RateModel, Reserve } from "@/lib/data/types";
import type { Candidate, Leg } from "./types";

/** Variable borrow APR at utilization `u` on an Aave V3 curve. */
export function borrowAprAt(u: number, m: RateModel): number {
  const x = Math.min(Math.max(u, 0), 1);
  if (x <= m.optimalUsage) return m.baseRate + (m.slope1 * x) / m.optimalUsage;
  return m.baseRate + m.slope1 + (m.slope2 * (x - m.optimalUsage)) / (1 - m.optimalUsage);
}

/** Supply APR at utilization `u`: borrowers' interest, shared over all deposits, minus the reserve factor. */
export function supplyAprAt(u: number, m: RateModel): number {
  const x = Math.min(Math.max(u, 0), 1);
  return borrowAprAt(x, m) * x * (1 - m.reserveFactor);
}

export function utilization(supplyUsd: number, debtUsd: number): number {
  return supplyUsd > 0 ? Math.min(1, debtUsd / supplyUsd) : 0;
}

export interface ReserveAfter {
  supplyRate: number;
  borrowRate: number;
  /** Multiply supply / borrow reward APRs by these to account for dilution. */
  supplyRewardScale: number;
  borrowRewardScale: number;
}

/**
 * Rates after adding `addSupply` and `addDebt` (USD). Anchored to the live on-chain rate:
 * we apply the model's *change* so small rounding differences in the model don't shift today's rate.
 */
export function reserveAfter(r: Reserve, addSupply: number, addDebt: number): ReserveAfter {
  const supply = r.totalSupplyUsd;
  const debt = r.totalDebtUsd;
  const newSupply = supply + addSupply;
  const newDebt = debt + addDebt;
  let supplyRate = r.supplyRate;
  let borrowRate = r.borrowRate;
  if (r.rateModel && (addSupply || addDebt)) {
    const u0 = utilization(supply, debt);
    const u1 = utilization(newSupply, newDebt);
    borrowRate = Math.max(0, r.borrowRate + aprToApy(borrowAprAt(u1, r.rateModel)) - aprToApy(borrowAprAt(u0, r.rateModel)));
    supplyRate = Math.max(0, r.supplyRate + aprToApy(supplyAprAt(u1, r.rateModel)) - aprToApy(supplyAprAt(u0, r.rateModel)));
  }
  return {
    supplyRate,
    borrowRate,
    supplyRewardScale: newSupply > 0 ? supply / newSupply : 1,
    borrowRewardScale: newDebt > 0 && debt > 0 ? debt / newDebt : 1,
  };
}

function findReserve(snapshot: MarketSnapshot, leg: Leg): Reserve | undefined {
  return snapshot.markets.find((m) => m.id === leg.marketId)?.reserves.find((r) => r.symbol === leg.symbol);
}

/**
 * Re-prices every leg for the amounts this strategy adds to each pool. Returns `limit` (a short
 * reason) when the amount doesn't fit: not enough cash to borrow, or a deposit/borrow cap is hit.
 */
export function applyMarketImpact(c: Candidate, snapshot: MarketSnapshot): { candidate: Candidate; limit?: string } {
  const deltas = new Map<string, { reserve: Reserve; supply: number; debt: number; market: string }>();
  for (const leg of c.legs) {
    const reserve = findReserve(snapshot, leg);
    if (!reserve) continue;
    const key = `${leg.marketId}|${leg.symbol}`;
    const d = deltas.get(key) ?? { reserve, supply: 0, debt: 0, market: leg.marketName };
    if (leg.role === "borrow") d.debt += leg.amountUsd;
    else d.supply += leg.amountUsd;
    deltas.set(key, d);
  }

  for (const { reserve: r, supply, debt, market } of deltas.values()) {
    if (debt > 0 && debt > r.availableLiquidityUsd + supply)
      return { candidate: c, limit: `not enough ${r.symbol} to borrow in the ${market}` };
    if (debt > 0 && r.borrowCapUsd !== undefined && r.totalDebtUsd + debt > r.borrowCapUsd)
      return { candidate: c, limit: `${r.symbol} borrow cap reached in the ${market}` };
    if (supply > 0 && r.supplyCapUsd !== undefined && r.totalSupplyUsd + supply > r.supplyCapUsd)
      return { candidate: c, limit: `${r.symbol} deposit cap reached in the ${market}` };
  }

  const legs = c.legs.map((leg) => {
    const d = deltas.get(`${leg.marketId}|${leg.symbol}`);
    if (!d) return leg;
    const after = reserveAfter(d.reserve, d.supply, d.debt);
    const borrowing = leg.role === "borrow";
    const scale = borrowing ? after.borrowRewardScale : after.supplyRewardScale;
    return {
      ...leg,
      baseRate: borrowing ? after.borrowRate : after.supplyRate,
      incentives: leg.incentives.map((i) => ({ ...i, apr: i.apr * scale })),
    };
  });
  return { candidate: { ...c, legs } };
}

import { getAsset } from "@/config/assets";
import type { EngineConfig } from "@/config/engine";
import type { MarketSnapshot } from "@/lib/data/types";
import { borrowFraction, carrySizes, effectiveLimits, positionEarnings, safetyScore } from "./math";
import type { Candidate, Leg, MarketReserve } from "./types";

export interface GenContext {
  snapshot: MarketSnapshot;
  config: EngineConfig;
}

export function allReserves(snapshot: MarketSnapshot): MarketReserve[] {
  return snapshot.markets.flatMap((market) => market.reserves.map((reserve) => ({ market, reserve })));
}

/** Maturity for a PT: live value from chain if known, else the config fallback. */
export function maturityOf(ctx: GenContext, symbol: string): string | undefined {
  return ctx.snapshot.maturities?.[symbol] ?? getAsset(symbol)?.builtInYield?.maturity;
}

export function family(symbol: string) {
  return getAsset(symbol)?.family;
}

export function isBorrowable(mr: MarketReserve, config: EngineConfig): boolean {
  const asset = getAsset(mr.reserve.symbol);
  return (
    !!asset &&
    !asset.supplyOnly &&
    mr.reserve.canBorrow &&
    mr.reserve.availableLiquidityUsd >= config.minLiquidityUsd
  );
}

export function isCollateral(mr: MarketReserve): boolean {
  return !!getAsset(mr.reserve.symbol) && mr.reserve.canCollateral && mr.reserve.canSupply && mr.reserve.ltv > 0;
}

export function isLendable(mr: MarketReserve): boolean {
  return !!getAsset(mr.reserve.symbol) && mr.reserve.canSupply;
}

export function makeLeg(
  role: Leg["role"],
  { market, reserve }: MarketReserve,
  amountUsd: number,
  builtInYields: Record<string, number>,
): Leg {
  const borrowing = role === "borrow";
  return {
    role,
    symbol: reserve.symbol,
    marketId: market.id,
    marketName: market.name,
    marketKind: market.kind,
    amountUsd,
    baseRate: borrowing ? reserve.borrowRate : reserve.supplyRate,
    builtInRate: borrowing ? 0 : (builtInYields[reserve.symbol] ?? 0),
    incentives: borrowing ? reserve.borrowIncentives : reserve.supplyIncentives,
  };
}

/** Deposit → borrow → lend, all sized from the principal. Collateral and debt must share a market. */
export function buildCarry(
  type: Candidate["type"],
  collateral: MarketReserve,
  debt: MarketReserve,
  lend: MarketReserve,
  ctx: GenContext,
): Candidate | null {
  if (collateral.market.id !== debt.market.id) return null;
  if (lend.market.id === debt.market.id && lend.reserve.symbol === debt.reserve.symbol) return null;
  const limits = effectiveLimits(collateral.market, collateral.reserve, debt.reserve);
  const b = borrowFraction(limits.ltv, ctx.config.leverageFraction);
  if (b <= 0) return null;
  const { deposited, borrowed } = carrySizes(ctx.config.principalUsd, b);
  const y = ctx.snapshot.builtInYields;
  return {
    type,
    legs: [
      makeLeg("deposit", collateral, deposited, y),
      makeLeg("borrow", debt, borrowed, y),
      makeLeg("lend", lend, borrowed, y),
    ],
    safetyScore: safetyScore(deposited, limits.liquidationThreshold, borrowed),
    vars: {
      deposit: collateral.reserve.symbol,
      borrow: debt.reserve.symbol,
      lend: lend.reserve.symbol,
      depositMarket: collateral.market.name,
      borrowMarket: debt.market.name,
      lendMarket: lend.market.name,
      maturity: [collateral, lend].map((m) => maturityOf(ctx, m.reserve.symbol)).find(Boolean),
    },
  };
}

export function netOf(c: Candidate, ctx: GenContext): number {
  return positionEarnings(c.legs, ctx.config.rewardValuation).net;
}

/** Keeps the highest-earning candidate per group key. */
export function bestPerGroup(
  candidates: { key: string; candidate: Candidate }[],
  ctx: GenContext,
): Candidate[] {
  const best = new Map<string, { net: number; candidate: Candidate }>();
  for (const { key, candidate } of candidates) {
    const net = netOf(candidate, ctx);
    const cur = best.get(key);
    if (!cur || net > cur.net) best.set(key, { net, candidate });
  }
  return [...best.values()].map((v) => v.candidate);
}

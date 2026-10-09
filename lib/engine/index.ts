import { ENGINE_CONFIG, type EngineConfig } from "@/config/engine";
import type { MarketSnapshot } from "@/lib/data/types";
import { classifyRisk, isRewardDriven } from "./classify";
import { collateralCarries } from "./generators/collateralCarry";
import { marketGaps } from "./generators/marketGap";
import { simpleDeposits } from "./generators/simpleDeposit";
import { stableCarries } from "./generators/stableCarry";
import { yieldLoops } from "./generators/yieldLoop";
import type { GenContext } from "./helpers";
import { applyMarketImpact } from "./impact";
import { positionEarnings, spreadEarnings } from "./math";
import { riskFactors } from "./risks";
import { renderText } from "./templates";
import type { Candidate, Strategy } from "./types";

export const GENERATORS: ((ctx: GenContext) => Candidate[])[] = [
  simpleDeposits,
  yieldLoops,
  marketGaps,
  stableCarries,
  collateralCarries,
];

export function strategyId(c: Candidate): string {
  return `${c.type}:${c.legs.map((l) => `${l.role}-${l.symbol}@${l.marketId}`).join("|")}`;
}

export function evaluate(c: Candidate, config: EngineConfig, heldPriceUsd: Record<string, number> = {}): Strategy {
  const earnings = positionEarnings(c.legs, config.rewardValuation, config.heldRewards);
  const spread = spreadEarnings(c.legs, config.principalUsd, config.rewardValuation, config.heldRewards);
  const rewardDriven = isRewardDriven(earnings, spread);
  const { risk, reasons } = classifyRisk(c, rewardDriven);
  return {
    ...c,
    id: strategyId(c),
    earnings,
    spread,
    netApr: earnings.net / config.principalUsd,
    rewardDriven,
    risk,
    riskReasons: reasons,
    riskFactors: riskFactors(c, earnings, spread, config, rewardDriven),
    text: renderText(c, earnings, spread, rewardDriven, config),
    heldPriceUsd,
  };
}

/**
 * Generates every strategy and keeps the ones where (1) the borrowed part pays for itself and
 * (2) the total beats the threshold. Ranked by net yearly rate.
 */
export interface EngineResult {
  strategies: Strategy[];
  /** Strategies left out because the amount doesn't fit their markets (cash or caps). */
  tooBig: number;
}

/**
 * Generates every strategy, re-prices it for the user's own amount (their deposit and loan move
 * the pool's rates and dilute rewards), drops ones that don't fit the market, and keeps those
 * where the borrowed part pays for itself and the total beats the threshold. Ranked by net yearly rate.
 */
export function runEngineDetailed(snapshot: MarketSnapshot, config: EngineConfig = ENGINE_CONFIG): EngineResult {
  const ctx: GenContext = { snapshot, config };
  let tooBig = 0;
  const priced = GENERATORS.flatMap((g) => g(ctx)).flatMap((c) => {
    const { candidate, limit } = applyMarketImpact(c, snapshot);
    if (limit) {
      tooBig++;
      return [];
    }
    return [candidate];
  });
  const strategies = priced
    .map((c) => evaluate(c, config, { DUST: snapshot.dustPriceUsd }))
    // Borrowing strategies must pay for their own loan; plain deposits have nothing borrowed.
    .filter((s) => (s.type === "simpleDeposit" || s.spread.net > 0) && s.netApr >= config.minNetApr)
    .sort((a, b) => b.netApr - a.netApr)
    .slice(0, config.maxResults);
  return { strategies, tooBig };
}

export function runEngine(snapshot: MarketSnapshot, config: EngineConfig = ENGINE_CONFIG): Strategy[] {
  return runEngineDetailed(snapshot, config).strategies;
}

export type { Strategy } from "./types";

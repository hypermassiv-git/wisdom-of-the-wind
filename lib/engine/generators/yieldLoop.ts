/**
 * Yield loop: deposit an asset that earns on its own (LST, PT, yield stable), borrow its plain
 * version, convert it back and redeposit. Repeated until the target borrow share is reached.
 */
import { getAsset } from "@/config/assets";
import { bestPerGroup, type GenContext, isBorrowable, isCollateral, makeLeg, maturityOf } from "../helpers";
import { borrowFraction, effectiveLimits, loopSizes, safetyScore } from "../math";
import type { Candidate } from "../types";

export function yieldLoops(ctx: GenContext): Candidate[] {
  const out: { key: string; candidate: Candidate }[] = [];
  for (const market of ctx.snapshot.markets) {
    for (const reserve of market.reserves) {
      const asset = getAsset(reserve.symbol);
      if (!asset?.loopsWith || !isCollateral({ market, reserve })) continue;
      const options = Array.isArray(asset.loopsWith) ? asset.loopsWith : [asset.loopsWith];
      for (const plain of market.reserves.filter((r) => options.includes(r.symbol))) {
      if (!isBorrowable({ market, reserve: plain }, ctx.config)) continue;

      const limits = effectiveLimits(market, reserve, plain);
      const b = borrowFraction(limits.ltv, ctx.config.leverageFraction);
      if (b <= 0) continue;
      const { supplied, borrowed } = loopSizes(ctx.config.principalUsd, b);
      const y = ctx.snapshot.builtInYields;

      out.push({ key: `${reserve.symbol}@${market.id}`, candidate: {
        type: "yieldLoop",
        legs: [
          makeLeg("deposit", { market, reserve }, supplied, y),
          makeLeg("borrow", { market, reserve: plain }, borrowed, y),
        ],
        safetyScore: safetyScore(supplied, limits.liquidationThreshold, borrowed),
        vars: {
          deposit: reserve.symbol,
          borrow: plain.symbol,
          depositMarket: market.name,
          borrowMarket: market.name,
          maturity: maturityOf(ctx, reserve.symbol),
        },
      } });
      }
    }
  }
  return bestPerGroup(out, ctx);
}

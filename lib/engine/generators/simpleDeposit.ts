/**
 * Simple deposit: put an asset in and let it earn (interest + its own yield + rewards).
 * No borrowing, so no liquidation. One result per asset per market.
 */
import { type GenContext, allReserves, isLendable, makeLeg, maturityOf } from "../helpers";
import type { Candidate } from "../types";

export function simpleDeposits(ctx: GenContext): Candidate[] {
  return allReserves(ctx.snapshot)
    .filter(isLendable)
    .map((mr) => ({
      type: "simpleDeposit" as const,
      legs: [makeLeg("deposit", mr, ctx.config.principalUsd, ctx.snapshot.builtInYields)],
      safetyScore: Infinity,
      vars: {
        deposit: mr.reserve.symbol,
        depositMarket: mr.market.name,
        borrowMarket: mr.market.name,
        maturity: maturityOf(ctx, mr.reserve.symbol),
      },
    }));
}

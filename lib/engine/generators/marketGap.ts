/**
 * Market gap carry: borrow an asset in one market and lend the same asset in another market
 * that pays more. The deposit is the best same-family asset in the borrowing market.
 */
import {
  allReserves,
  bestPerGroup,
  buildCarry,
  family,
  type GenContext,
  isBorrowable,
  isCollateral,
  isLendable,
} from "../helpers";
import type { Candidate } from "../types";

export function marketGaps(ctx: GenContext): Candidate[] {
  const all = allReserves(ctx.snapshot);
  const found: { key: string; candidate: Candidate }[] = [];

  for (const debt of all.filter((mr) => isBorrowable(mr, ctx.config))) {
    const lends = all.filter(
      (mr) => isLendable(mr) && mr.reserve.symbol === debt.reserve.symbol && mr.market.id !== debt.market.id,
    );
    const collaterals = all.filter(
      (mr) =>
        mr.market.id === debt.market.id && isCollateral(mr) && family(mr.reserve.symbol) === family(debt.reserve.symbol),
    );
    for (const lend of lends) {
      for (const collateral of collaterals) {
        const c = buildCarry("marketGap", collateral, debt, lend, ctx);
        if (c) found.push({ key: `${debt.reserve.symbol}:${debt.market.id}>${lend.market.id}`, candidate: c });
      }
    }
  }
  return bestPerGroup(found, ctx);
}

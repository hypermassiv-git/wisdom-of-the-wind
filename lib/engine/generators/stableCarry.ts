/**
 * Stablecoin carry: deposit a stablecoin, borrow another stablecoin that is cheap,
 * and lend a different stablecoin that pays more. One result per place you lend.
 */
import { getAsset } from "@/config/assets";
import {
  allReserves,
  bestPerGroup,
  buildCarry,
  type GenContext,
  isBorrowable,
  isCollateral,
  isLendable,
} from "../helpers";
import type { Candidate, MarketReserve } from "../types";

const stable = (mr: MarketReserve) => !!getAsset(mr.reserve.symbol)?.isStable;

export function stableCarries(ctx: GenContext): Candidate[] {
  const all = allReserves(ctx.snapshot);
  const found: { key: string; candidate: Candidate }[] = [];

  for (const debt of all.filter((mr) => stable(mr) && isBorrowable(mr, ctx.config))) {
    const collaterals = all.filter((mr) => mr.market.id === debt.market.id && stable(mr) && isCollateral(mr));
    const lends = all.filter((mr) => stable(mr) && isLendable(mr) && mr.reserve.symbol !== debt.reserve.symbol);
    for (const lend of lends) {
      for (const collateral of collaterals) {
        // Depositing more of your own deposit asset in the same pool isn't a separate strategy.
        if (lend.market.id === collateral.market.id && lend.reserve.symbol === collateral.reserve.symbol) continue;
        const c = buildCarry("stableCarry", collateral, debt, lend, ctx);
        if (c) found.push({ key: `${lend.reserve.symbol}@${lend.market.id}`, candidate: c });
      }
    }
  }
  return bestPerGroup(found, ctx);
}

/**
 * Collateral carry: deposit a non-stable asset (gold, BTC, ETH, MON…), borrow stablecoins
 * against it and lend them where they earn more. One result per deposit asset.
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

export function collateralCarries(ctx: GenContext): Candidate[] {
  const all = allReserves(ctx.snapshot);
  const lends = all.filter((mr) => stable(mr) && isLendable(mr));
  const found: { key: string; candidate: Candidate }[] = [];

  for (const collateral of all.filter((mr) => !stable(mr) && isCollateral(mr))) {
    const debts = all.filter(
      (mr) => mr.market.id === collateral.market.id && stable(mr) && isBorrowable(mr, ctx.config),
    );
    for (const debt of debts) {
      for (const lend of lends) {
        const c = buildCarry("collateralCarry", collateral, debt, lend, ctx);
        if (c) found.push({ key: `${collateral.reserve.symbol}@${collateral.market.id}`, candidate: c });
      }
    }
  }
  return bestPerGroup(found, ctx);
}

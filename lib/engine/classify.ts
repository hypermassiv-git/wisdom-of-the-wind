import { displayName, getAsset, type PriceFamily } from "@/config/assets";

const FAMILY_WORD: Record<PriceFamily, string> = {
  MON: "MON-based",
  USD: "dollar-based",
  BTC: "bitcoin",
  ETH: "ether",
  GOLD: "gold-based",
};
import { RISK_POINTS, RISK_THRESHOLDS } from "@/config/engine";
import type { Candidate, Earnings, RiskLevel } from "./types";

/**
 * On base rates alone, borrowing loses money (either overall or on the borrowed part),
 * but rewards make it profitable.
 */
export function isRewardDriven(earnings: Earnings, spread: Earnings): boolean {
  return (earnings.interest < 0 || spread.interest < 0) && spread.net > 0 && earnings.net > 0;
}

export function classifyRisk(c: Candidate, rewardDriven: boolean): { risk: RiskLevel; reasons: string[] } {
  let points = RISK_POINTS.base;
  const reasons: string[] = [];
  const deposit = c.legs.find((l) => l.role === "deposit")!;
  const borrow = c.legs.find((l) => l.role === "borrow");

  const depositFamily = getAsset(deposit.symbol)?.family;
  if (!borrow) {
    reasons.push("Nothing is borrowed, so your deposit can't be liquidated");
  } else if (depositFamily !== getAsset(borrow.symbol)?.family) {
    points += RISK_POINTS.priceExposure;
    reasons.push(`Your ${displayName(deposit.symbol)} and the ${displayName(borrow.symbol)} you owe can move apart in price`);
  } else {
    reasons.push(
      `Your deposit and your loan are both ${FAMILY_WORD[depositFamily!]}, so they mostly move together in price`,
    );
  }
  if (c.type === "yieldLoop") {
    points += RISK_POINTS.loop;
    reasons.push("Repeating the borrowing multiplies both gains and losses");
  }
  // A plain deposit is the "lend" side too; lending into an isolated market can tie cash up briefly.
  const lentOut = c.legs.some(
    (l) =>
      (l.role === "lend" || c.type === "simpleDeposit") &&
      l.marketKind === "isolated" &&
      getAsset(l.symbol)?.builtInYield?.kind !== "pt",
  );
  if (lentOut) {
    points += RISK_POINTS.isolatedLend;
    reasons.push("Money lent in a smaller, separate market can be briefly tied up if most of it is borrowed");
  }
  if (rewardDriven) {
    points += RISK_POINTS.rewardDriven;
    reasons.push("Earnings depend on reward rates staying about where they are");
  }

  const risk: RiskLevel =
    points <= RISK_THRESHOLDS.low ? "Low" : points <= RISK_THRESHOLDS.medium ? "Medium" : "High";
  return { risk, reasons };
}

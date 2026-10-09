import { baseName, getAsset } from "@/config/assets";
import type { Leg, Strategy } from "@/lib/engine/types";

/** Yearly USD per token, in order of first appearance. Tokens shown under one name (WMON and MON) are merged. */
function byToken(parts: [string, number][]): [string, number][] {
  const totals = new Map<string, [string, number]>();
  for (const [token, v] of parts) {
    const key = baseName(token);
    const prev = totals.get(key);
    // Show the token under its display name so the icon matches the label (WMON → MON).
    totals.set(key, [getAsset(key) ? key : token, (prev?.[1] ?? 0) + v]);
  }
  return [...totals.values()];
}

/** Market interest is paid in the leg's own token; built-in yield in the token it builds up in (MON for LSTs). */
function earnedParts(l: Leg): [string, number][] {
  const builtIn = getAsset(l.symbol)?.builtInYield?.paidIn ?? l.symbol;
  return [
    [l.symbol, l.amountUsd * l.baseRate],
    [builtIn, l.amountUsd * l.builtInRate],
  ];
}

export interface Breakdown {
  /** Interest earned per token, sub-$1 rows hidden (at least one row). */
  earnedByToken: [string, number][];
  /** Reward rows: MON first, other liquid tokens next, DUST always last (at least one row). */
  rewards: [string, number][];
  /** Loan interest paid per token. */
  paidByToken: [string, number][];
  /** Total interest earned. */
  earned: number;
  /** Earned plus rewards: the full width of the bar. */
  positive: number;
}

/** Yearly earnings split into rows: earned + rewards − paid = total. */
export function breakdown(s: Strategy): Breakdown {
  const earnedAll = byToken(s.legs.filter((l) => l.role !== "borrow").flatMap(earnedParts));
  const earned = earnedAll.reduce((sum, [, v]) => sum + v, 0);
  // Hide sub-$1 rows (e.g. a sliver of lending interest), but always show at least one.
  const earnedByToken = earnedAll.filter(([, v]) => Math.abs(v) >= 0.5);
  if (!earnedByToken.length) earnedByToken.push([earnedAll[0][0], earned]);
  const paidByToken = byToken(
    s.legs.filter((l) => l.role === "borrow").map((l) => [l.symbol, l.amountUsd * l.baseRate]),
  ).filter(([, v]) => v > 0.5);
  const rank = (t: string) => (t === "MON" ? 0 : t === "DUST" ? 2 : 1);
  const rewards = Object.entries(s.earnings.rewardsByToken)
    .filter(([, v]) => v > 0.005)
    .sort(([a], [b]) => rank(a) - rank(b));
  if (!rewards.length) rewards.push(["DUST", 0]);
  return { earnedByToken, rewards, paidByToken, earned, positive: earned + s.earnings.rewards };
}

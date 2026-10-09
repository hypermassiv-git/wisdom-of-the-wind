/** Post text, X link and file name for sharing a strategy on X. The card image itself is drawn in lib/shareCard.ts. */

import { breakdown } from "@/lib/breakdown";
import { displayName } from "@/config/assets";
import type { Strategy } from "@/lib/engine/types";

export const SITE_URL = "https://wisdom-of-the-wind.vercel.app";

/** "wisdom-of-the-wind-boosted-shmon-yield.png" */
export function shareFileName(s: Strategy): string {
  const slug = s.text.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `wisdom-of-the-wind-${slug || "strategy"}.png`;
}

/** Neverland's X account, tagged in every post. */
export const NEVERLAND_X = "@Neverland_Money";

/** "PT-AUSD isolated market" → "PT-AUSD market"; "main pool" stays. */
const market = (name: string) => name.replace(" isolated", "");

/** What the strategy does, in plain words. No numbers: the card shows those. */
function describe(s: Strategy): string {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  const d = displayName(deposit.symbol);
  const b = borrow ? displayName(borrow.symbol) : "";
  const l = lend ? displayName(lend.symbol) : "";
  // "earn with earnAUSD", or "lend it in the PT-AUSD market" when the borrowed coin is lent as is.
  const earn = lend && borrow && lend.symbol === borrow.symbol ? `lend it in the ${market(lend.marketName)}` : `earn with ${l}`;
  switch (s.type) {
    case "simpleDeposit":
      return `A simple one: deposit ${d} in the ${market(deposit.marketName)} and let it earn. No loan and no looping.`;
    case "yieldLoop":
      return `Looping ${d}: deposit it, borrow ${b} against it, turn that into more ${d} and deposit again. The same position, earning on more than was put in.`;
    case "marketGap":
      return `Same coin, two rates. Borrow ${b} in the ${market(borrow!.marketName)} and lend it in the ${market(lend!.marketName)}, where it pays more.`;
    case "stableCarry":
      return `Stablecoins from start to finish: borrow ${b} against ${d}, then ${earn}.`;
    case "collateralCarry":
      return `Holding ${d} and still putting it to work: borrow ${b} against it and ${earn}.`;
  }
}

/**
 * The post text: a neutral description of the strategy and a nudge to Neverland. No numbers (the card has them)
 * and no links, since X shows posts with links to fewer people.
 */
export function shareText(s: Strategy): string {
  const dust = breakdown(s).held.length ? "\n\nBuilds DUST along the way, a piece of Neverland." : "";
  return `${describe(s)}${dust}\n\nPossible on ${NEVERLAND_X}`;
}

/** X's post composer with the text filled in. */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text })}`;
}

/** Post text, X link and file name for sharing a strategy on X. The card image itself is drawn in lib/shareCard.ts. */

import { breakdown } from "@/lib/breakdown";
import { displayName, getAsset } from "@/config/assets";
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

/** The coins and markets a post names, in display form. */
function names(s: Strategy) {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  const l = lend ? displayName(lend.symbol) : "";
  return {
    d: displayName(deposit.symbol),
    b: borrow ? displayName(borrow.symbol) : "",
    // "earn with earnAUSD", or "lend it in the PT-AUSD market" when the borrowed coin is lent as is.
    earn: lend && borrow && lend.symbol === borrow.symbol ? `lend it in the ${market(lend.marketName)}` : `earn with ${l}`,
    stable: getAsset(deposit.symbol)?.family === "USD",
  };
}

const N = NEVERLAND_X;

/**
 * Three voices for the post, picked at random per share so posts don't all look the same. Written about the strategy,
 * never as if the person sharing is in it. No numbers (the card has them) and no emojis.
 */
const VOICES: ((s: Strategy) => string)[] = [
  // Found-it
  (s) => {
    const { d, b, earn } = names(s);
    switch (s.type) {
      case "yieldLoop":
        return `Found a way to put ${d} to work on ${N}. Deposit it, borrow ${b}, turn that into more ${d}, repeat. Numbers on the card.`;
      case "simpleDeposit":
        return `Found a no-fuss spot for ${d} on ${N}. Just deposit and let it earn, no loan, no looping.`;
      case "marketGap":
        return `Found the same coin paying two different rates on ${N}. Borrow ${b} where it's cheap, lend it where it pays more.`;
      case "stableCarry":
        return `Found a stablecoin-only play on ${N}: borrow ${b} against ${d}, then ${earn}. Dollars start to finish.`;
      case "collateralCarry":
        return `Found a way to keep holding ${d} and still put it to work on ${N}: borrow ${b} against it, then ${earn}.`;
    }
  },
  // Short and punchy
  (s) => {
    const { d } = names(s);
    switch (s.type) {
      case "yieldLoop":
        return `Not bad for some ${d}. Looped on ${N}`;
      case "simpleDeposit":
        return `${d}, just sitting there earning. ${N}`;
      case "marketGap":
        return `Borrow cheap, lend higher, same coin. ${N}`;
      case "stableCarry":
        return `Stables in, stables out, still earning. ${N}`;
      case "collateralCarry":
        return `Keep the ${d}, let it earn anyway. ${N}`;
    }
  },
  // Question hook
  (s) => {
    const { d, b, earn, stable } = names(s);
    switch (s.type) {
      case "yieldLoop":
        return `Anyone looping ${d} on ${N}? Borrow ${b}, turn it into more ${d}, deposit again. Ran the numbers.`;
      case "simpleDeposit":
        return stable
          ? `Where are people parking stablecoins right now? This is what plain ${d} gets on ${N}.`
          : `Got ${d} sitting idle? This is what it earns just deposited on ${N}.`;
      case "marketGap":
        return `Why is ${b} cheaper to borrow in one market than it pays in another? Spotted this on ${N}.`;
      case "stableCarry":
        return `Who says stablecoins have to sit idle? Borrow ${b} against ${d} on ${N}, then ${earn}.`;
      case "collateralCarry":
        return `Holding ${d} and not doing anything with it? Borrow ${b} against it on ${N} and ${earn}.`;
    }
  },
];

/** The post text, in one of the voices above, plus a line about DUST when the strategy earns it. No links, since X shows posts with links to fewer people. */
export function shareText(s: Strategy, pick = Math.random()): string {
  const voice = VOICES[Math.floor(pick * VOICES.length)];
  const dust = breakdown(s).held.length
    ? "\n\nBonus: it earns DUST too, which can be locked for a weekly cut of Neverland's revenue."
    : "";
  return `${voice(s)}${dust}`;
}

/** X's post composer with the text filled in. */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text })}`;
}

/**
 * Opens the composer in the X app, where the user is signed in. Phones send x.com links to the browser instead,
 * which asks them to sign in again.
 */
export function xAppUrl(text: string): string {
  return `twitter://post?message=${encodeURIComponent(text)}`;
}

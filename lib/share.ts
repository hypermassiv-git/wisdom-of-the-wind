/** Post text, X link and file name for sharing a strategy on X. The card image itself is drawn in lib/shareCard.ts. */

import { breakdown } from "@/lib/breakdown";
import { tokenAmount, usd } from "@/lib/format";
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

/**
 * The post text: plain and factual, tagging Neverland. No links, since X shows posts with links to fewer people.
 * DUST is given in tokens, never dollars.
 */
export function shareText(s: Strategy, principalUsd: number): string {
  const held = breakdown(s).held.map(([token, n]) => `${tokenAmount(n)} ${token}`);
  const piece = held.length ? `, plus ${held.join(" and ")} toward my piece of Neverland` : "";
  return `On ${NEVERLAND_X}: ${s.text.name}\n\nAbout ${usd(s.earnings.net)} a year on ${usd(principalUsd)} at today's rates${piece}.`;
}

/** X's post composer with the text filled in. */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text })}`;
}

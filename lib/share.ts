/** Text, links and file name for sharing a strategy on X. The card image itself is drawn in lib/shareCard.ts. */

import { breakdown } from "@/lib/breakdown";
import { tokenAmount, usd } from "@/lib/format";
import { startAsset } from "@/lib/sortFilter";
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

/** The post text. DUST is given in tokens, never dollars. The link is passed separately so X shows it once. */
export function shareText(s: Strategy, principalUsd: number): string {
  const held = breakdown(s).held.map(([token, n]) => `${tokenAmount(n)} ${token}`);
  const piece = held.length ? `, plus ${held.join(" and ")}, my piece of Neverland` : "";
  return `${s.text.name}: about ${usd(s.earnings.net)} a year on ${usd(principalUsd)} on Neverland${piece}.\n\nFound it with Wisdom of the Wind 🌬️`;
}

/** Opens the site on the strategies that start with the same token. */
export function shareLink(s: Strategy): string {
  return `${SITE_URL}/?have=${encodeURIComponent(startAsset(s))}`;
}

/** X's post composer with the text and link filled in. */
export function xIntentUrl(text: string, link: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url: link })}`;
}

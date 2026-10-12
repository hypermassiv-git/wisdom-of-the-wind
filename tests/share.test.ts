import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import { runEngine } from "@/lib/engine";
import { heldTokens } from "@/lib/engine/math";
import { breakdown } from "@/lib/breakdown";
import { shareFileName, shareText, xAppUrl, xIntentUrl } from "@/lib/share";

const all = runEngine(mockSnapshot(new Date("2026-01-01T00:00:00Z")), { ...ENGINE_CONFIG, maxResults: 999 });

describe("share helpers", () => {
  it("names the file after the strategy", () => {
    for (const s of all) expect(shareFileName(s)).toMatch(/^wisdom-of-the-wind-[a-z0-9]+(-[a-z0-9]+)*\.png$/);
  });

  // One pick per voice: shareText chooses with Math.floor(pick * 3).
  const picks = [0, 0.4, 0.8];

  it("writes every strategy type in each voice, tagging Neverland, with no numbers, links, emojis or first person", () => {
    const types = new Set(all.map((s) => s.type));
    expect(types.size).toBe(5);
    for (const s of all) {
      const texts = picks.map((p) => shareText(s, p));
      expect(new Set(texts).size).toBe(3);
      for (const text of texts) {
        expect(text).toContain("@Neverland_Money");
        // Token names can hold a digit (USDT0), so ban amounts rather than every digit.
        expect(text).not.toMatch(/[$%]|\d{2,}|https?:|Wisdom of the Wind|undefined|\b(I|my|me)\b|\p{Extended_Pictographic}/u);
      }
    }
  });

  it("adds the DUST bonus line, without an amount, only when the strategy builds it", () => {
    for (const s of all) {
      const builds = breakdown(s).held.length > 0;
      for (const p of picks) {
        expect(shareText(s, p).endsWith("\n\nBonus: it earns DUST too, which can be locked for a weekly cut of Neverland's revenue.")).toBe(builds);
      }
    }
  });

  it("builds an X intent link with only the text", () => {
    const url = new URL(xIntentUrl("A & B: $5 @Neverland_Money\nnext"));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe("A & B: $5 @Neverland_Money\nnext");
    expect(url.searchParams.has("url")).toBe(false);
  });
});

describe("xAppUrl", () => {
  it("opens the X app's composer with the text intact", () => {
    const text = "A & B: borrow AUSD\n\nPossible on @Neverland_Money";
    const url = xAppUrl(text);
    expect(url.startsWith("twitter://post?message=")).toBe(true);
    expect(decodeURIComponent(url.slice("twitter://post?message=".length))).toBe(text);
  });
});

describe("breakdown", () => {
  it("adds up to net earnings, with DUST kept out and given in tokens", () => {
    for (const s of all) {
      const b = breakdown(s);
      const rewards = b.rewards.reduce((sum, [, v]) => sum + v, 0);
      const paid = s.legs.filter((l) => l.role === "borrow").reduce((sum, l) => sum + l.amountUsd * l.baseRate, 0);
      expect(b.earned + rewards - paid).toBeCloseTo(s.earnings.net, 6);
      expect(b.rewards.some(([t]) => t === "DUST")).toBe(false);
      if (b.rewards.some(([t]) => t === "MON")) expect(b.rewards[0][0]).toBe("MON");
      const dust = b.held.find(([t]) => t === "DUST");
      if (dust) expect(dust[1]).toBeCloseTo(heldTokens(s.earnings.heldByToken.DUST, s.heldPriceUsd.DUST), 6);
    }
  });
});

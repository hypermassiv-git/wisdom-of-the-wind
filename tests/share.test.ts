import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import { runEngine } from "@/lib/engine";
import { heldTokens } from "@/lib/engine/math";
import { breakdown } from "@/lib/breakdown";
import { shareFileName, shareText, xIntentUrl } from "@/lib/share";

const all = runEngine(mockSnapshot(new Date("2026-01-01T00:00:00Z")), { ...ENGINE_CONFIG, maxResults: 999 });

describe("share helpers", () => {
  it("names the file after the strategy", () => {
    for (const s of all) expect(shareFileName(s)).toMatch(/^wisdom-of-the-wind-[a-z0-9]+(-[a-z0-9]+)*\.png$/);
  });

  it("writes post text with the yearly dollars and amount, tagging Neverland and with no links", () => {
    for (const s of all) {
      const text = shareText(s, 1000);
      expect(text).toContain(s.text.name);
      expect(text).toContain("a year on $1,000");
      expect(text).toContain("@Neverland_Money");
      expect(text).not.toMatch(/https?:\/\/|\.money|\.app|Wisdom of the Wind/);
    }
  });

  it("gives DUST in tokens as your piece of Neverland, never in dollars", () => {
    const withDust = all.find((s) => (s.earnings.heldByToken.DUST ?? 0) > 0)!;
    const text = shareText(withDust, 1000);
    expect(text).toMatch(/plus [\d,.]+ DUST toward my piece of Neverland/);
    expect(text).not.toMatch(/\$[\d,.]+ (in )?DUST/);
    const noDust = all.find((s) => !s.earnings.heldByToken.DUST);
    if (noDust) expect(shareText(noDust, 1000)).not.toContain("DUST");
  });

  it("builds an X intent link with only the text", () => {
    const url = new URL(xIntentUrl("A & B: $5 @Neverland_Money\nnext"));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe("A & B: $5 @Neverland_Money\nnext");
    expect(url.searchParams.has("url")).toBe(false);
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

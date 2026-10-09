import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import { runEngine } from "@/lib/engine";
import { heldTokens } from "@/lib/engine/math";
import { breakdown } from "@/lib/breakdown";
import { shareFileName, shareLink, shareText, xIntentUrl } from "@/lib/share";

const all = runEngine(mockSnapshot(new Date("2026-01-01T00:00:00Z")), { ...ENGINE_CONFIG, maxResults: 999 });

describe("share helpers", () => {
  it("names the file after the strategy", () => {
    for (const s of all) expect(shareFileName(s)).toMatch(/^wisdom-of-the-wind-[a-z0-9]+(-[a-z0-9]+)*\.png$/);
  });

  it("writes post text with the yearly dollars and amount", () => {
    const s = all[0];
    const text = shareText(s, 1000);
    expect(text).toContain(s.text.name);
    expect(text).toContain("a year on $1,000");
  });

  it("gives DUST in tokens as your piece of Neverland, never in dollars", () => {
    const withDust = all.find((s) => (s.earnings.heldByToken.DUST ?? 0) > 0)!;
    const text = shareText(withDust, 1000);
    expect(text).toMatch(/plus [\d,.]+ DUST, my piece of Neverland/);
    expect(text).not.toMatch(/\$[\d,.]+ (in )?DUST/);
    const noDust = all.find((s) => !s.earnings.heldByToken.DUST);
    if (noDust) expect(shareText(noDust, 1000)).not.toContain("DUST");
  });

  it("links the post to Neverland", () => {
    expect(shareLink()).toBe("https://app.neverland.money");
  });

  it("builds an X intent link that keeps text and url intact", () => {
    const url = new URL(xIntentUrl("A & B: $5 🌬️\nnext", "https://x.test/?have=PT-AUSD"));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe("A & B: $5 🌬️\nnext");
    expect(url.searchParams.get("url")).toBe("https://x.test/?have=PT-AUSD");
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

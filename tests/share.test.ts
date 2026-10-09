import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import { runEngine } from "@/lib/engine";
import { breakdown } from "@/lib/breakdown";
import { shareFileName, shareLink, shareText, xIntentUrl } from "@/lib/share";
import { startAsset } from "@/lib/sortFilter";

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

  it("links back to strategies for the same start token", () => {
    for (const s of all) {
      const url = new URL(shareLink(s));
      expect(url.origin).toBe("https://wisdom-of-the-wind.vercel.app");
      expect(url.searchParams.get("have")).toBe(startAsset(s));
    }
  });

  it("builds an X intent link that keeps text and url intact", () => {
    const url = new URL(xIntentUrl("A & B: $5 🌬️\nnext", "https://x.test/?have=PT-AUSD"));
    expect(url.origin + url.pathname).toBe("https://x.com/intent/post");
    expect(url.searchParams.get("text")).toBe("A & B: $5 🌬️\nnext");
    expect(url.searchParams.get("url")).toBe("https://x.test/?have=PT-AUSD");
  });
});

describe("breakdown", () => {
  it("adds up to the strategy's net earnings, with DUST last", () => {
    for (const s of all) {
      const b = breakdown(s);
      const rewards = b.rewards.reduce((sum, [, v]) => sum + v, 0);
      const paid = s.legs.filter((l) => l.role === "borrow").reduce((sum, l) => sum + l.amountUsd * l.baseRate, 0);
      expect(b.earned + rewards - paid).toBeCloseTo(s.earnings.net, 6);
      const dust = b.rewards.findIndex(([t]) => t === "DUST");
      if (dust >= 0) expect(dust).toBe(b.rewards.length - 1);
      if (b.rewards[0][0] !== "DUST" && b.rewards.some(([t]) => t === "MON")) expect(b.rewards[0][0]).toBe("MON");
    }
  });
});

import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import { runEngine } from "@/lib/engine";
import { ASSETS } from "@/config/assets";
import { countByType, heldAssets, priceExposure, sortAndFilter, startAsset } from "@/lib/sortFilter";

const all = runEngine(mockSnapshot(new Date("2026-01-01T00:00:00Z")), { ...ENGINE_CONFIG, maxResults: 999 });
const order = { Low: 0, Medium: 1, High: 2 } as const;

describe("sortAndFilter", () => {
  it("sorts by best yield by default", () => {
    const out = sortAndFilter(all, "yield", "all");
    for (let i = 1; i < out.length; i++) expect(out[i - 1].netApr).toBeGreaterThanOrEqual(out[i].netApr);
  });

  it("sorts by lowest risk, stablecoins first within a level, then yield", () => {
    const out = sortAndFilter(all, "risk", "all");
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1], b = out[i];
      expect(order[a.risk]).toBeLessThanOrEqual(order[b.risk]);
      if (a.risk === b.risk) {
        expect(priceExposure(a)).toBeLessThanOrEqual(priceExposure(b));
        const loan = (x: typeof a) => x.legs.some((l) => l.role === "borrow");
        if (priceExposure(a) === priceExposure(b)) expect(Number(loan(a))).toBeLessThanOrEqual(Number(loan(b)));
      }
    }
  });

  it("filters by strategy type", () => {
    const loops = sortAndFilter(all, "yield", "yieldLoop");
    expect(loops.length).toBeGreaterThan(0);
    expect(loops.every((s) => s.type === "yieldLoop")).toBe(true);
  });

  it("counts strategies per type", () => {
    const counts = countByType(all);
    expect(Object.values(counts).reduce((a, b) => a + b!, 0)).toBe(all.length);
    expect(counts.yieldLoop).toBe(all.filter((s) => s.type === "yieldLoop").length);
  });
});

describe("filtering by the token you have", () => {
  const deposit = (s: (typeof all)[number]) => s.legs.find((l) => l.role === "deposit")!.symbol;

  it("names the start token by its display name", () => {
    for (const s of all) {
      if (deposit(s) === "WMON") expect(startAsset(s)).toBe("MON");
      if (deposit(s).startsWith("PT-AUSD")) expect(startAsset(s)).toBe("PT-AUSD");
    }
  });

  it("only keeps strategies that start with that token as is", () => {
    const ausd = sortAndFilter(all, "yield", "all", "AUSD");
    expect(ausd.length).toBeGreaterThan(0);
    expect(ausd.every((s) => deposit(s) === "AUSD")).toBe(true);
    const mon = sortAndFilter(all, "yield", "all", "MON");
    expect(mon.every((s) => deposit(s) === "WMON" || deposit(s) === "MON")).toBe(true);
  });

  it("lists every start token once, in asset registry order", () => {
    const held = heldAssets(all);
    expect(new Set(held.map((a) => a.name)).size).toBe(held.length);
    expect(new Set(held.map((a) => a.name))).toEqual(new Set(all.map(startAsset)));
    const rank = held.map((a) => ASSETS.findIndex((x) => x.display === a.name));
    expect(rank).toEqual([...rank].sort((a, b) => a - b));
    expect(held.find((a) => a.name === "syzUSD")?.plain).toBe(false);
    expect(held.find((a) => a.name === "AUSD")?.plain).toBe(true);
  });
});

describe("riskFactors", () => {
  it("has exactly one lead factor per strategy", () => {
    for (const s of all) expect(s.riskFactors.filter((r) => r.lead)).toHaveLength(1);
  });

  it("never mentions DUST", () => {
    for (const s of all) for (const r of s.riskFactors) expect(`${r.label} ${r.stat} ${r.detail}`).not.toMatch(/DUST/);
  });

  it("leads with the right kind of risk", () => {
    for (const s of all) {
      const lead = s.riskFactors[0].kind;
      if (s.type === "collateralCarry") expect(lead).toBe("liquidation");
      if (s.type === "stableCarry") expect(lead).toBe("borrowRate");
      if (s.type === "yieldLoop" && s.vars.deposit.includes("MON")) expect(lead).toBe("price");
    }
  });

  it("never shows liquidation on plain deposits, and reassures instead", () => {
    for (const s of all.filter((s) => s.type === "simpleDeposit")) {
      expect(s.riskFactors.some((r) => r.kind === "liquidation")).toBe(false);
      expect(s.riskFactors.some((r) => r.kind === "safe")).toBe(true);
    }
  });
});

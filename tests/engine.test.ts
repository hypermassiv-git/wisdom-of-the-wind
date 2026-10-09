import { describe, expect, it } from "vitest";
import { getAsset } from "@/config/assets";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import type { MarketSnapshot } from "@/lib/data/types";
import { runEngine } from "@/lib/engine";
import { fill, TEMPLATES } from "@/lib/engine/templates";

const snapshot = mockSnapshot(new Date("2026-01-01T00:00:00Z"));
const all = runEngine(snapshot, { ...ENGINE_CONFIG, maxResults: 999 });

describe("runEngine on mock data", () => {
  it("produces every strategy type", () => {
    const types = new Set(all.map((s) => s.type));
    expect(types).toEqual(new Set(["simpleDeposit", "yieldLoop", "marketGap", "stableCarry", "collateralCarry"]));
  });

  it("ranks by net yearly rate, highest first", () => {
    for (let i = 1; i < all.length; i++) expect(all[i - 1].netApr).toBeGreaterThanOrEqual(all[i].netApr);
  });

  it("only shows strategies above the threshold where borrowing pays for itself", () => {
    for (const s of all) {
      expect(s.netApr).toBeGreaterThanOrEqual(ENGINE_CONFIG.minNetApr);
      if (s.type !== "simpleDeposit") expect(s.spread.net).toBeGreaterThan(0);
    }
  });

  it("keeps DUST out of totals and ranking, as held tokens with a price", () => {
    const withDust = runEngine(snapshot, { ...ENGINE_CONFIG, heldRewards: [], maxResults: 999 });
    const counted = new Map(withDust.map((s) => [s.id, s.netApr]));
    for (const s of all) {
      expect(s.earnings.rewardsByToken.DUST).toBeUndefined();
      expect(s.heldPriceUsd.DUST).toBe(snapshot.dustPriceUsd);
      const prev = counted.get(s.id);
      if (prev !== undefined) expect(s.netApr).toBeLessThanOrEqual(prev + 1e-12);
    }
    expect(all.some((s) => (s.earnings.heldByToken.DUST ?? 0) > 0)).toBe(true);
  });

  it("respects a higher threshold", () => {
    const strict = runEngine(snapshot, { ...ENGINE_CONFIG, minNetApr: 0.12, maxResults: 999 });
    expect(strict.length).toBeGreaterThan(0);
    expect(strict.length).toBeLessThan(all.length);
    expect(strict.every((s) => s.netApr >= 0.12)).toBe(true);
  });

  it("never borrows supply-only assets", () => {
    for (const s of all) {
      const borrow = s.legs.find((l) => l.role === "borrow");
      if (borrow) expect(getAsset(borrow.symbol)?.supplyOnly).not.toBe(true);
    }
  });

  it("loops syzUSD with the best of its stablecoin borrow options", () => {
    const loops = all.filter((s) => s.type === "yieldLoop" && s.vars.deposit === "syzUSD");
    expect(loops).toHaveLength(1);
    expect(["USDC", "USDT0", "AUSD"]).toContain(loops[0].vars.borrow);
    expect(loops[0].legs[0].marketId).toBe("syzusd");
  });

  it("includes the known loops", () => {
    const loops = all.filter((s) => s.type === "yieldLoop").map((s) => `${s.vars.deposit}/${s.vars.borrow}`);
    expect(loops).toEqual(expect.arrayContaining(["shMON/WMON", "PT-AUSD/AUSD", "PT-shMON/WMON", "earnAUSD/AUSD"]));
  });

  it("finds the AUSD market gap from the main pool into the PT-AUSD market", () => {
    const gap = all.find(
      (s) =>
        s.type === "marketGap" &&
        s.vars.borrow === "AUSD" &&
        s.legs[1].marketId === "main" &&
        s.legs[2].marketId === "pt-ausd",
    );
    expect(gap).toBeDefined();
  });

  it("tags reward-driven strategies when base rates lose money on the borrowed part", () => {
    const rd = all.filter((s) => s.rewardDriven);
    expect(rd.length).toBeGreaterThan(0);
    for (const s of rd) {
      expect(s.spread.interest).toBeLessThan(0);
      expect(s.spread.net).toBeGreaterThan(0);
      expect(s.text.whyNow).toMatch(/DUST|rewards/);
    }
  });

  it("rates cross-family collateral carries as at least Medium risk", () => {
    const cc = all.filter((s) => s.type === "collateralCarry");
    expect(cc.length).toBeGreaterThan(0);
    for (const s of cc) expect(s.risk).not.toBe("Low");
  });

  it("rates a same-asset PT loop that pays on interest as Low risk", () => {
    const loop = all.find((s) => s.type === "yieldLoop" && s.vars.deposit === "PT-shMON")!;
    expect(loop.rewardDriven).toBe(false);
    expect(loop.risk).toBe("Low");
  });

  it("keeps a conservative safety score", () => {
    for (const s of all) expect(s.safetyScore).toBeGreaterThan(1.5);
  });

  it("fills every template placeholder with live values", () => {
    for (const s of all) {
      for (const text of Object.values(s.text)) expect(text).not.toMatch(/[{}]/);
    }
  });

  it("explains why it works with a dollar figure", () => {
    for (const s of all) expect(s.text.whyNow).toMatch(/\$\d/);
  });

  it("never makes the DUST price the main risk", () => {
    for (const s of all) expect(s.text.mainRisk).not.toMatch(/DUST/);
  });

  it("leads MON-based loops with MON price exposure in dollars", () => {
    const monLoops = all.filter((s) => s.type === "yieldLoop" && getAsset(s.vars.deposit)?.family === "MON");
    expect(monLoops.length).toBeGreaterThan(0);
    for (const s of monLoops) expect(s.text.mainRisk).toMatch(/^Looping \S+ makes this as much a bet on MON .* worth about \$[\d,]+/);
  });

  it("leads stablecoin borrowing strategies with the borrow rate", () => {
    const stable = all.filter((s) => s.type === "stableCarry");
    expect(stable.length).toBeGreaterThan(0);
    for (const s of stable) expect(s.text.mainRisk).toMatch(/borrow rate is [\d.]+% today/);
  });

  it("keeps liquidation as the lead risk when borrowing against a volatile asset", () => {
    for (const s of all.filter((s) => s.type === "collateralCarry")) expect(s.text.mainRisk).toMatch(/liquidation/);
  });

  it("varies the main risk across strategies", () => {
    const openings = new Set(all.map((s) => s.text.mainRisk.split(" ").slice(0, 4).join(" ")));
    expect(openings.size).toBeGreaterThanOrEqual(4);
  });

  it("says PTs are swapped inside the Neverland app", () => {
    // Cards where the user swaps into a PT: PT loops, and carries that lend into a PT.
    const pt = all.filter(
      (s) =>
        (s.type === "yieldLoop" && s.vars.deposit.startsWith("PT-")) ||
        s.legs.some((l) => l.role === "lend" && l.symbol.startsWith("PT-")),
    );
    expect(pt.length).toBeGreaterThan(0);
    for (const s of pt) expect(s.text.action).toMatch(/Neverland app/);
  });

  it("offers plain deposits with no borrowing, rated Low unless in an isolated market", () => {
    const plain = all.filter((s) => s.type === "simpleDeposit");
    expect(plain.length).toBeGreaterThan(0);
    for (const s of plain) {
      expect(s.legs).toHaveLength(1);
      if (s.legs[0].marketKind === "main") expect(s.risk).toBe("Low");
    }
  });

  it("returns no borrowing strategies when borrowing is expensive everywhere", () => {
    const pricey: MarketSnapshot = structuredClone(snapshot);
    for (const m of pricey.markets)
      for (const r of m.reserves) {
        r.borrowRate = 0.5;
        r.borrowIncentives = [];
      }
    expect(runEngine(pricey).filter((s) => s.type !== "simpleDeposit")).toEqual([]);
  });
});

describe("fill", () => {
  it("replaces placeholders and fails loudly on missing ones", () => {
    expect(fill("Borrow {a} for {b}", { a: "AUSD", b: "5%" })).toBe("Borrow AUSD for 5%");
    expect(() => fill(TEMPLATES.yieldLoop.name, {})).toThrow(/deposit/);
  });
});

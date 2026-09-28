import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "@/config/engine";
import { mockSnapshot } from "@/lib/data/mock";
import type { RateModel, Reserve } from "@/lib/data/types";
import { runEngineDetailed } from "@/lib/engine";
import { borrowAprAt, reserveAfter, supplyAprAt, utilization } from "@/lib/engine/impact";

// Neverland's USDC curve (read on-chain): 5% base, +4% to the 90% kink, +50% after.
const USDC: RateModel = { baseRate: 0.05, slope1: 0.04, slope2: 0.5, optimalUsage: 0.9, reserveFactor: 0.1 };

describe("rate curve", () => {
  it("rises gently to the kink and steeply after", () => {
    expect(borrowAprAt(0, USDC)).toBeCloseTo(0.05);
    expect(borrowAprAt(0.45, USDC)).toBeCloseTo(0.07);
    expect(borrowAprAt(0.9, USDC)).toBeCloseTo(0.09);
    expect(borrowAprAt(0.95, USDC)).toBeCloseTo(0.34);
    expect(borrowAprAt(1, USDC)).toBeCloseTo(0.59);
  });

  it("pays depositors borrowers' interest, shared out and minus the reserve factor", () => {
    // 50% utilization: borrow ≈ 7.22%, × 0.5 × 0.9
    expect(supplyAprAt(0.5, USDC)).toBeCloseTo(borrowAprAt(0.5, USDC) * 0.5 * 0.9);
    expect(utilization(1_000_000, 600_000)).toBeCloseTo(0.6);
  });
});

describe("reserveAfter", () => {
  const r = {
    supplyRate: 0.03,
    borrowRate: 0.07,
    totalSupplyUsd: 1_000_000,
    totalDebtUsd: 800_000,
    rateModel: USDC,
  } as Reserve;

  it("leaves rates unchanged for no action", () => {
    const a = reserveAfter(r, 0, 0);
    expect(a.supplyRate).toBe(0.03);
    expect(a.borrowRate).toBe(0.07);
  });

  it("lowers the supply rate and dilutes rewards when you deposit", () => {
    const a = reserveAfter(r, 500_000, 0);
    expect(a.supplyRate).toBeLessThan(0.03);
    expect(a.supplyRewardScale).toBeCloseTo(1_000_000 / 1_500_000);
  });

  it("raises the borrow rate, sharply past the kink, when you borrow", () => {
    const small = reserveAfter(r, 0, 10_000);
    const big = reserveAfter(r, 0, 150_000); // 80% → 95% utilization
    expect(small.borrowRate).toBeGreaterThan(0.07);
    expect(big.borrowRate - 0.07).toBeGreaterThan(0.2);
    expect(big.borrowRewardScale).toBeCloseTo(800_000 / 950_000);
  });
});

describe("engine with the user's amount", () => {
  const snap = mockSnapshot(new Date("2026-01-01T00:00:00Z"));
  const at = (principalUsd: number) => runEngineDetailed(snap, { ...ENGINE_CONFIG, principalUsd, maxResults: 999 });

  it("barely moves rates at small amounts", () => {
    const loop = at(1_000).strategies.find((s) => s.type === "yieldLoop")!;
    const borrow = loop.legs.find((l) => l.role === "borrow")!;
    const reserve = snap.markets.find((m) => m.id === borrow.marketId)!.reserves.find((r) => r.symbol === borrow.symbol)!;
    expect(Math.abs(borrow.baseRate - reserve.borrowRate)).toBeLessThan(0.001);
  });

  it("earns a lower yearly rate at large amounts", () => {
    const small = at(1_000).strategies.find((s) => s.type === "simpleDeposit" && s.legs[0].symbol === "USDC")!;
    const big = at(5_000_000).strategies.find((s) => s.type === "simpleDeposit" && s.legs[0].symbol === "USDC")!;
    expect(big.netApr).toBeLessThan(small.netApr);
  });

  it("drops strategies that don't fit the market's cash", () => {
    const huge = at(50_000_000);
    expect(huge.tooBig).toBeGreaterThan(0);
    for (const s of huge.strategies) {
      for (const leg of s.legs.filter((l) => l.role === "borrow")) {
        const r = snap.markets.find((m) => m.id === leg.marketId)!.reserves.find((x) => x.symbol === leg.symbol)!;
        expect(leg.amountUsd).toBeLessThanOrEqual(r.availableLiquidityUsd + 1e-6 + 50_000_000);
      }
    }
    expect(at(1_000).tooBig).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  borrowFraction,
  carrySizes,
  effectiveLimits,
  loopSizes,
  positionEarnings,
  safetyScore,
  spreadEarnings,
} from "@/lib/engine/math";
import type { Leg } from "@/lib/engine/types";
import type { Market, Reserve } from "@/lib/data/types";

const leg = (l: Partial<Leg> & Pick<Leg, "role" | "amountUsd">): Leg => ({
  symbol: "X",
  marketId: "main",
  marketName: "main pool",
  marketKind: "main",
  baseRate: 0,
  builtInRate: 0,
  incentives: [],
  ...l,
});

describe("sizing", () => {
  it("borrows the configured share of max LTV", () => {
    expect(borrowFraction(0.8, 0.5)).toBeCloseTo(0.4);
    expect(borrowFraction(0, 0.5)).toBe(0);
  });

  it("sums the loop as a geometric series", () => {
    // b = 0.5 → deposit 2000, borrow 1000
    const { supplied, borrowed } = loopSizes(1000, 0.5);
    expect(supplied).toBeCloseTo(2000);
    expect(borrowed).toBeCloseTo(1000);
  });

  it("sizes a single-step carry", () => {
    expect(carrySizes(1000, 0.4)).toEqual({ deposited: 1000, borrowed: 400 });
  });

  it("computes a threshold-weighted safety score", () => {
    expect(safetyScore(2000, 0.9, 1000)).toBeCloseTo(1.8);
    expect(safetyScore(1000, 0.8, 0)).toBe(Infinity);
  });
});

describe("effectiveLimits", () => {
  const r = (p: Partial<Reserve>): Reserve =>
    ({ symbol: "A", ltv: 0.6, liquidationThreshold: 0.7, ...p }) as Reserve;
  const market = {
    eModes: [{ id: 1, label: "c", ltv: 0.9, liquidationThreshold: 0.93 }],
  } as Market;

  it("uses e-mode limits when both assets share a category", () => {
    expect(effectiveLimits(market, r({ eModeId: 1 }), r({ eModeId: 1 }))).toEqual({
      ltv: 0.9,
      liquidationThreshold: 0.93,
    });
  });

  it("falls back to the deposit's own limits otherwise", () => {
    expect(effectiveLimits(market, r({ eModeId: 1 }), r({ eModeId: 2 }))).toEqual({
      ltv: 0.6,
      liquidationThreshold: 0.7,
    });
  });
});

describe("positionEarnings", () => {
  it("adds deposit yield, subtracts borrow cost, splits rewards by token", () => {
    // Loop: $2000 of an LST at 1% supply + 7% staking, $1000 MON borrowed at 5%.
    const legs = [
      leg({ role: "deposit", amountUsd: 2000, baseRate: 0.01, builtInRate: 0.07, incentives: [{ token: "DUST", apr: 0.02 }] }),
      leg({ role: "borrow", amountUsd: 1000, baseRate: 0.05, builtInRate: 0.9, incentives: [{ token: "DUST", apr: 0.01 }] }),
    ];
    const e = positionEarnings(legs, { DUST: 1 });
    // interest: 2000×0.08 − 1000×0.05 = 110 (built-in yield never applies to a borrow)
    expect(e.interest).toBeCloseTo(110);
    // rewards: 2000×0.02 + 1000×0.01 = 50
    expect(e.rewards).toBeCloseTo(50);
    expect(e.rewardsByToken).toEqual({ DUST: 50 });
    expect(e.net).toBeCloseTo(160);
  });

  it("applies the reward valuation factor", () => {
    const legs = [leg({ role: "lend", amountUsd: 1000, incentives: [{ token: "DUST", apr: 0.1 }, { token: "MON", apr: 0.01 }] })];
    const e = positionEarnings(legs, { DUST: 0.5 });
    expect(e.rewardsByToken.DUST).toBeCloseTo(50);
    expect(e.rewardsByToken.MON).toBeCloseTo(10); // unlisted tokens valued at 1
  });

  it("puts bonus tokens on top of the total instead of inside it", () => {
    const legs = [
      leg({ role: "lend", amountUsd: 1000, baseRate: 0.03, incentives: [{ token: "DUST", apr: 0.05 }, { token: "MON", apr: 0.01 }] }),
    ];
    const e = positionEarnings(legs, { DUST: 1 }, ["DUST"]);
    expect(e.rewardsByToken).toEqual({ MON: 10 });
    expect(e.heldByToken.DUST).toBeCloseTo(50);
    expect(e.rewards).toBeCloseTo(10);
    expect(e.net).toBeCloseTo(40);
    expect(spreadEarnings(legs, 0, { DUST: 1 }, ["DUST"]).heldByToken.DUST).toBeCloseTo(50);
  });
});

describe("spreadEarnings", () => {
  it("excludes the principal's own deposit earnings", () => {
    const legs = [
      leg({ role: "deposit", amountUsd: 1000, baseRate: 0.1 }),
      leg({ role: "borrow", amountUsd: 400, baseRate: 0.06 }),
      leg({ role: "lend", amountUsd: 400, baseRate: 0.05 }),
    ];
    // Only the borrowed part: 400×(0.05 − 0.06) = −4
    expect(spreadEarnings(legs, 1000, {}).interest).toBeCloseTo(-4);
    expect(positionEarnings(legs, {}).interest).toBeCloseTo(96);
  });

  it("counts the extra looped deposit", () => {
    const legs = [
      leg({ role: "deposit", amountUsd: 2000, builtInRate: 0.07 }),
      leg({ role: "borrow", amountUsd: 1000, baseRate: 0.05 }),
    ];
    // 1000×0.07 − 1000×0.05 = 20
    expect(spreadEarnings(legs, 1000, {}).interest).toBeCloseTo(20);
  });
});

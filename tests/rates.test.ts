import { describe, expect, it } from "vitest";
import { aprToApy, emissionApr, RAY, rayToApr, SECONDS_PER_YEAR, v2SpotPrice } from "@/lib/data/rates";

describe("rayToApr", () => {
  it("converts ray-encoded rates", () => {
    expect(rayToApr(RAY / 20n)).toBeCloseTo(0.05, 9); // 5%
    expect(rayToApr(0n)).toBe(0);
  });
});

describe("aprToApy", () => {
  it("compounds per second", () => {
    expect(aprToApy(0.05)).toBeCloseTo(Math.exp(0.05) - 1, 6);
    expect(aprToApy(0)).toBe(0);
  });
});

describe("emissionApr", () => {
  const base = {
    rewardDecimals: 18,
    rewardPriceUsd: 0.05,
    poolValueUsd: 1_000_000,
    distributionEnd: 2_000_000_000,
    nowSeconds: 1_700_000_000,
  };

  it("values yearly emissions against the pool size", () => {
    // 1 token/sec × 31.536M sec × $0.05 = $1.5768M a year on a $1M pool → 157.68%
    const apr = emissionApr({ ...base, emissionPerSecond: 10n ** 18n });
    expect(apr).toBeCloseTo((SECONDS_PER_YEAR * 0.05) / 1_000_000, 9);
  });

  it("is zero after distribution ends or for an empty pool", () => {
    expect(emissionApr({ ...base, emissionPerSecond: 10n ** 18n, distributionEnd: 1 })).toBe(0);
    expect(emissionApr({ ...base, emissionPerSecond: 10n ** 18n, poolValueUsd: 0 })).toBe(0);
  });
});

describe("v2SpotPrice", () => {
  it("prices the base token in the quote token", () => {
    // 1,000,000 DUST (18 dp) vs 42,000 USDC (6 dp) → $0.042
    expect(
      v2SpotPrice({
        reserveBase: 1_000_000n * 10n ** 18n,
        reserveQuote: 42_000n * 10n ** 6n,
        baseDecimals: 18,
        quoteDecimals: 6,
      }),
    ).toBeCloseTo(0.042, 9);
  });
});

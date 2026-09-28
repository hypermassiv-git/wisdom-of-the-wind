/**
 * Sample market data for building and testing without chain access.
 * Numbers are illustrative, not real Neverland rates.
 */
import type { Incentive, MarketSnapshot, Reserve } from "./types";

type R = Partial<Reserve> & Pick<Reserve, "symbol">;

/** A typical Aave curve for sample data: 0% base, 7% to the 90% kink, then steep. */
const SAMPLE_MODEL = { baseRate: 0, slope1: 0.07, slope2: 0.6, optimalUsage: 0.9, reserveFactor: 0.1 };

function reserve(r: R): Reserve {
  const total = r.totalSupplyUsd ?? 5_000_000;
  const available = r.availableLiquidityUsd ?? 2_000_000;
  return {
    totalDebtUsd: Math.max(0, total - available),
    rateModel: r.canBorrow ? SAMPLE_MODEL : undefined,
    supplyRate: 0,
    borrowRate: 0,
    ltv: 0,
    liquidationThreshold: 0,
    canBorrow: false,
    canCollateral: false,
    canSupply: true,
    priceUsd: 1,
    totalSupplyUsd: 5_000_000,
    availableLiquidityUsd: 2_000_000,
    supplyIncentives: [],
    borrowIncentives: [],
    ...r,
  };
}

const dust = (apr: number): Incentive[] => [{ token: "DUST", apr }];

export function mockSnapshot(now = new Date()): MarketSnapshot {
  // Fixed sample yields, kept separate from config fallbacks so tests stay stable.
  const builtInYields: Record<string, number> = {
    gMON: 0.07,
    shMON: 0.075,
    sMON: 0.072,
    "PT-shMON": 0.14,
    earnAUSD: 0.06,
    "PT-AUSD": 0.11,
    syzUSD: 0.073,
  };

  return {
    source: "mock",
    fetchedAt: now.toISOString(),
    dustPriceUsd: 0.042,
    builtInYields,
    maturities: { "PT-AUSD": "2026-12-31", "PT-shMON": "2026-12-31" },
    markets: [
      {
        id: "main",
        name: "main pool",
        kind: "main",
        eModes: [
          { id: 1, label: "MON-correlated", ltv: 0.9, liquidationThreshold: 0.93 },
          { id: 2, label: "Stablecoins", ltv: 0.93, liquidationThreshold: 0.95 },
        ],
        reserves: [
          reserve({
            symbol: "WMON", priceUsd: 0.045, supplyRate: 0.021, borrowRate: 0.048,
            ltv: 0.65, liquidationThreshold: 0.72, canBorrow: true, canCollateral: true, eModeId: 1,
            totalSupplyUsd: 18_000_000, availableLiquidityUsd: 7_000_000,
            supplyIncentives: dust(0.012), borrowIncentives: dust(0.018),
          }),
          reserve({
            symbol: "shMON", priceUsd: 0.0465, ltv: 0.6, liquidationThreshold: 0.7,
            canCollateral: true, eModeId: 1, supplyIncentives: dust(0.01),
          }),
          reserve({
            symbol: "sMON", priceUsd: 0.0462, ltv: 0.6, liquidationThreshold: 0.7,
            canCollateral: true, eModeId: 1, supplyIncentives: dust(0.004),
          }),
          reserve({
            symbol: "gMON", priceUsd: 0.046, ltv: 0.55, liquidationThreshold: 0.65,
            canCollateral: true, eModeId: 1,
          }),
          reserve({
            symbol: "USDC", supplyRate: 0.052, borrowRate: 0.071, ltv: 0.75, liquidationThreshold: 0.8,
            canBorrow: true, canCollateral: true, eModeId: 2, totalSupplyUsd: 25_000_000,
            availableLiquidityUsd: 6_000_000, supplyIncentives: dust(0.015), borrowIncentives: dust(0.01),
          }),
          reserve({
            symbol: "USDT0", supplyRate: 0.047, borrowRate: 0.066, ltv: 0.75, liquidationThreshold: 0.8,
            canBorrow: true, canCollateral: true, eModeId: 2, totalSupplyUsd: 14_000_000,
            availableLiquidityUsd: 4_000_000, supplyIncentives: dust(0.012),
          }),
          reserve({
            symbol: "AUSD", supplyRate: 0.041, borrowRate: 0.058, ltv: 0.75, liquidationThreshold: 0.8,
            canBorrow: true, canCollateral: true, eModeId: 2, totalSupplyUsd: 12_000_000,
            availableLiquidityUsd: 4_500_000, supplyIncentives: dust(0.01), borrowIncentives: dust(0.022),
          }),
          reserve({
            symbol: "earnAUSD", supplyRate: 0.004, ltv: 0.72,
            liquidationThreshold: 0.78, canCollateral: true, eModeId: 2,
            supplyIncentives: dust(0.008),
          }),
          reserve({
            symbol: "cbBTC", priceUsd: 112_000, supplyRate: 0.002, borrowRate: 0.012, ltv: 0.73,
            liquidationThreshold: 0.78, canBorrow: true, canCollateral: true,
            supplyIncentives: dust(0.006),
          }),
          reserve({
            symbol: "WBTC", priceUsd: 112_000, supplyRate: 0.001, borrowRate: 0.011, ltv: 0.7,
            liquidationThreshold: 0.75, canBorrow: true, canCollateral: true,
          }),
          reserve({
            symbol: "WETH", priceUsd: 4_100, supplyRate: 0.009, borrowRate: 0.025, ltv: 0.8,
            liquidationThreshold: 0.83, canBorrow: true, canCollateral: true,
            supplyIncentives: dust(0.005),
          }),
          reserve({
            symbol: "XAUT0", priceUsd: 3_700, supplyRate: 0.0005, borrowRate: 0.009, ltv: 0.7,
            liquidationThreshold: 0.75, canBorrow: true, canCollateral: true,
            supplyIncentives: dust(0.011),
          }),
        ],
      },
      {
        id: "pt-ausd",
        name: "PT-AUSD isolated market",
        kind: "isolated",
        eModes: [],
        reserves: [
          reserve({
            symbol: "PT-AUSD", priceUsd: 0.97, ltv: 0.86, liquidationThreshold: 0.9,
            canCollateral: true, supplyIncentives: dust(0.004),
          }),
          reserve({
            symbol: "AUSD", supplyRate: 0.078, borrowRate: 0.094, canBorrow: true,
            totalSupplyUsd: 3_000_000, availableLiquidityUsd: 450_000,
            supplyIncentives: dust(0.018), borrowIncentives: dust(0.012),
          }),
        ],
      },
      {
        id: "pt-shmon",
        name: "PT-shMON isolated market",
        kind: "isolated",
        eModes: [],
        reserves: [
          reserve({
            symbol: "PT-shMON", priceUsd: 0.0425, ltv: 0.82, liquidationThreshold: 0.87,
            canCollateral: true,
          }),
          reserve({
            symbol: "WMON", priceUsd: 0.045, supplyRate: 0.042, borrowRate: 0.089, canBorrow: true,
            totalSupplyUsd: 2_500_000, availableLiquidityUsd: 600_000,
            // Base rate is below the main pool's borrow rate; rewards make up the difference.
            supplyIncentives: [...dust(0.03), { token: "MON", apr: 0.012 }],
            borrowIncentives: dust(0.02),
          }),
        ],
      },
      {
        id: "syzusd",
        name: "syzUSD isolated market",
        kind: "isolated",
        eModes: [],
        reserves: [
          reserve({
            symbol: "syzUSD", priceUsd: 1.05, ltv: 0.7, liquidationThreshold: 0.75,
            canCollateral: true, totalSupplyUsd: 65_000, supplyIncentives: dust(0.02),
          }),
          reserve({
            symbol: "USDC", supplyRate: 0.018, borrowRate: 0.04, canBorrow: true,
            totalSupplyUsd: 800_000, availableLiquidityUsd: 450_000, borrowIncentives: dust(0.015),
          }),
          reserve({
            symbol: "AUSD", supplyRate: 0.017, borrowRate: 0.039, canBorrow: true,
            totalSupplyUsd: 800_000, availableLiquidityUsd: 450_000, borrowIncentives: dust(0.02),
          }),
        ],
      },
    ],
  };
}

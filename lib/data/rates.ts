/** Pure converters from raw Aave V3 values to yearly rates. */

export const RAY = 10n ** 27n;
export const SECONDS_PER_YEAR = 31_536_000;

/** Aave stores rates as yearly APR in ray (1e27). */
export function rayToApr(rate: bigint): number {
  // Keep 9 decimals of precision before converting to float.
  return Number((rate * 1_000_000_000n) / RAY) / 1e9;
}

/** Converts a yearly APR to APY with per-second compounding (matches Aave's UI). */
export function aprToApy(apr: number): number {
  return Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;
}

export function rayToApy(rate: bigint): number {
  return aprToApy(rayToApr(rate));
}

/**
 * Reward APR = yearly emissions × reward price ÷ USD value of the pool receiving them.
 * Returns 0 when distribution has ended or the pool is empty.
 */
export function emissionApr(params: {
  emissionPerSecond: bigint;
  rewardDecimals: number;
  rewardPriceUsd: number;
  poolValueUsd: number;
  distributionEnd: number;
  nowSeconds: number;
}): number {
  const { emissionPerSecond, rewardDecimals, rewardPriceUsd, poolValueUsd, distributionEnd, nowSeconds } =
    params;
  if (poolValueUsd <= 0 || distributionEnd <= nowSeconds || emissionPerSecond === 0n) return 0;
  const perSecond = Number(emissionPerSecond) / 10 ** rewardDecimals;
  return (perSecond * SECONDS_PER_YEAR * rewardPriceUsd) / poolValueUsd;
}

/** Uniswap V2 spot price of `base` in `quote` from pair reserves. */
export function v2SpotPrice(params: {
  reserveBase: bigint;
  reserveQuote: bigint;
  baseDecimals: number;
  quoteDecimals: number;
}): number {
  const { reserveBase, reserveQuote, baseDecimals, quoteDecimals } = params;
  if (reserveBase === 0n) return 0;
  return Number(reserveQuote) / 10 ** quoteDecimals / (Number(reserveBase) / 10 ** baseDecimals);
}

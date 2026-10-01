/**
 * Asset registry — the single place to describe every asset the engine knows about.
 *
 * To add a new asset:
 *   1. Add an entry below with its price family and (if any) built-in yield.
 *   2. If it's an asset you can loop (e.g. a new LST), set `loopsWith` to the plain asset you borrow
 *      (or a list of them; the engine keeps whichever pays best).
 *   3. Make sure the on-chain symbol matches `symbol`, or add an alias in `onchainSymbols`
 *      (or `onchainPrefix` for Pendle PTs, whose symbols carry a maturity date).
 */

import { llamaPool, pendlePt, type YieldContext } from "@/lib/data/yieldSources";

/** Assets in the same family move together in price, so borrowing one against another is low risk. */
export type PriceFamily = "MON" | "USD" | "BTC" | "ETH" | "GOLD";

export type BuiltInYieldKind =
  | "lst" // liquid staking token: earns MON staking rewards
  | "pt" // Pendle-style principal token: fixed yield until maturity
  | "yieldStable"; // stablecoin that earns on its own (e.g. earnAUSD)

export interface BuiltInYield {
  kind: BuiltInYieldKind;
  /** Yearly rate as a decimal (0.07 = 7%). Fallback when the live source is unavailable. */
  staticApr: number;
  /** Short plain-English description of where the yield comes from. */
  source: string;
  /** For PTs: fallback maturity date (ISO). In live mode it's read from the on-chain symbol. */
  maturity?: string;
  /**
   * Live source (see lib/data/yieldSources.ts). If it throws or returns null,
   * `staticApr` is used instead.
   */
  live?: (ctx: YieldContext) => Promise<number | null>;
}

export interface AssetConfig {
  symbol: string;
  /** What beginners see. e.g. WMON is shown as "MON". */
  display: string;
  family: PriceFamily;
  isStable: boolean;
  /** Can be deposited but never borrowed (gMON, shMON, sMON). */
  supplyOnly?: boolean;
  builtInYield?: BuiltInYield;
  /** For yield loops: the plain asset you borrow and convert back into this one. */
  loopsWith?: string | string[];
  /**
   * How you turn the plain asset into this one: "inApp" = swap inside the Neverland app
   * (PTs), "swap" = on a DEX (LSTs, earnAUSD).
   */
  conversion?: "inApp" | "swap" | "stake" | "deposit";
  /** For LSTs: who issues it. Users can stake MON with them directly, or swap on a DEX. */
  stakeWith?: string;
  /** Other symbols the chain may report for this asset. */
  onchainSymbols?: string[];
  /** Matches any on-chain symbol starting with this (e.g. "PT-AUSD-" for "PT-AUSD-8OCT2026"). */
  onchainPrefix?: string;
  /** Treat as the same reserve as another symbol (native MON is used through WMON). */
  sameReserveAs?: string;
}

// Built-in yields are fetched live (DefiLlama for LSTs and earnAUSD, Pendle for PTs).
// `staticApr` values are fallbacks, last checked 2026-09-25.
export const ASSETS: AssetConfig[] = [
  // ---- MON family ----
  { symbol: "MON", display: "MON", family: "MON", isStable: false, sameReserveAs: "WMON" },
  { symbol: "WMON", display: "MON", family: "MON", isStable: false },
  {
    symbol: "gMON",
    display: "gMON",
    family: "MON",
    isStable: false,
    supplyOnly: true,
    builtInYield: {
      kind: "lst",
      staticApr: 0.107,
      source: "MON staking rewards",
      live: llamaPool("96f74061-dc9a-4ef7-8117-6cd3935230de"), // magma-staking gMON
    },
    loopsWith: "WMON",
    conversion: "stake",
    stakeWith: "Magma",
  },
  {
    symbol: "shMON",
    display: "shMON",
    family: "MON",
    isStable: false,
    supplyOnly: true,
    builtInYield: {
      kind: "lst",
      staticApr: 0.129,
      source: "MON staking rewards",
      live: llamaPool("ee40513c-9356-4c53-9f26-446b484a8ae2"), // shmonad shMON
    },
    loopsWith: "WMON",
    conversion: "stake",
    stakeWith: "FastLane",
  },
  {
    symbol: "sMON",
    display: "sMON",
    family: "MON",
    isStable: false,
    supplyOnly: true,
    builtInYield: {
      kind: "lst",
      staticApr: 0.058,
      source: "MON staking rewards",
      live: llamaPool("73c511a9-4dc0-4397-babe-e578fd75f0dd"), // kintsu sMON
    },
    loopsWith: "WMON",
    conversion: "stake",
    stakeWith: "Kintsu",
  },
  {
    symbol: "PT-shMON",
    display: "PT-shMON",
    family: "MON",
    isStable: false,
    onchainPrefix: "PT-shMON-",
    builtInYield: {
      kind: "pt",
      staticApr: 0.116,
      source: "a fixed rate locked in until maturity",
      maturity: "2027-03-18",
      live: pendlePt(),
    },
    loopsWith: "WMON",
    conversion: "inApp",
  },

  // ---- USD family ----
  { symbol: "USDC", display: "USDC", family: "USD", isStable: true },
  { symbol: "USDT0", display: "USDT0", family: "USD", isStable: true },
  { symbol: "AUSD", display: "AUSD", family: "USD", isStable: true },
  {
    symbol: "earnAUSD",
    display: "earnAUSD",
    family: "USD",
    isStable: true,
    builtInYield: {
      kind: "yieldStable",
      staticApr: 0.057,
      source: "the earnAUSD vault's yield",
      live: llamaPool("e10580de-1ad2-4bbc-a0e8-ad4db95df4a3"), // upshift earnAUSD
    },
    loopsWith: "AUSD",
    conversion: "swap",
  },
  {
    symbol: "syzUSD",
    display: "syzUSD",
    family: "USD",
    isStable: true,
    builtInYield: {
      kind: "yieldStable",
      staticApr: 0.073,
      source: "Yuzu's staking yield",
      live: llamaPool("c51e151e-44ad-4f25-9911-102bd00811dc"), // yuzu-money syzUSD
    },
    loopsWith: ["USDC", "USDT0", "AUSD"],
    conversion: "swap",
  },
  {
    symbol: "PT-AUSD",
    display: "PT-AUSD",
    family: "USD",
    isStable: true,
    onchainPrefix: "PT-AUSD-",
    builtInYield: {
      kind: "pt",
      staticApr: 0.059,
      source: "a fixed rate locked in until maturity",
      maturity: "2026-12-17",
      live: pendlePt(),
    },
    loopsWith: "AUSD",
    conversion: "inApp",
  },

  // ---- Others ----
  { symbol: "cbBTC", display: "cbBTC", family: "BTC", isStable: false },
  { symbol: "WBTC", display: "WBTC", family: "BTC", isStable: false },
  { symbol: "WETH", display: "WETH", family: "ETH", isStable: false },
  { symbol: "XAUT0", display: "XAUT0 (gold)", family: "GOLD", isStable: false },
];

const bySymbol = new Map(ASSETS.map((a) => [a.symbol, a]));
const byOnchain = new Map<string, AssetConfig>();
for (const a of ASSETS) {
  byOnchain.set(a.symbol.toLowerCase(), a);
  for (const s of a.onchainSymbols ?? []) byOnchain.set(s.toLowerCase(), a);
}

export function getAsset(symbol: string): AssetConfig | undefined {
  return bySymbol.get(symbol);
}

export function assetFromOnchainSymbol(symbol: string): AssetConfig | undefined {
  const lower = symbol.toLowerCase();
  return (
    byOnchain.get(lower) ??
    ASSETS.find((a) => a.onchainPrefix && lower.startsWith(a.onchainPrefix.toLowerCase()))
  );
}

export function displayName(symbol: string): string {
  return bySymbol.get(symbol)?.display ?? symbol;
}

export function sameFamily(a: string, b: string): boolean {
  const fa = bySymbol.get(a)?.family;
  return fa !== undefined && fa === bySymbol.get(b)?.family;
}

export function builtInApr(symbol: string, overrides?: Record<string, number>): number {
  if (overrides && symbol in overrides) return overrides[symbol];
  return bySymbol.get(symbol)?.builtInYield?.staticApr ?? 0;
}

/**
 * Resolves built-in yields, using live sources where configured.
 * `addresses` maps symbol → on-chain address (needed for PT lookups).
 */
export async function resolveBuiltInYields(
  addresses: Record<string, string> = {},
): Promise<{ yields: Record<string, number>; live: Record<string, boolean> }> {
  const yields: Record<string, number> = {};
  const live: Record<string, boolean> = {};
  await Promise.all(
    ASSETS.filter((a) => a.builtInYield).map(async (a) => {
      const y = a.builtInYield!;
      yields[a.symbol] = y.staticApr;
      live[a.symbol] = false;
      if (!y.live) return;
      try {
        const v = await y.live({ address: addresses[a.symbol] });
        if (v !== null && Number.isFinite(v)) {
          yields[a.symbol] = v;
          live[a.symbol] = true;
        } else {
          console.warn(`[yields] no live value for ${a.symbol}; using fallback ${y.staticApr}`);
        }
      } catch (err) {
        console.warn(`[yields] live source failed for ${a.symbol}; using fallback`, err);
      }
    }),
  );
  return { yields, live };
}

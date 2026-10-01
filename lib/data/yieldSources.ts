/**
 * Live sources for assets' built-in yields. Each returns a yearly rate as a decimal,
 * or null if the source is unavailable (the static fallback in config/assets.ts is used then).
 */

const TIMEOUT_MS = 8_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export interface YieldContext {
  /** On-chain address of the asset (known in live mode). */
  address?: string;
}

/** A DefiLlama yields pool. `apyBase` excludes the pool's own token rewards. */
export function llamaPool(poolId: string, field: "apy" | "apyBase" = "apyBase") {
  return async (): Promise<number | null> => {
    const body = await getJson<{ data: { apy: number | null; apyBase: number | null }[] }>(
      `https://yields.llama.fi/poolsEnriched?pool=${poolId}`,
    );
    const v = body.data?.[0]?.[field];
    return typeof v === "number" ? v / 100 : null;
  };
}

interface PendleMarket {
  pt: string;
  expiry: string;
  details: { impliedApy: number };
}

let pendleCache: { at: number; markets: PendleMarket[] } | null = null;

async function pendleMarkets(chainId: number): Promise<PendleMarket[]> {
  if (pendleCache && Date.now() - pendleCache.at < 60_000) return pendleCache.markets;
  const body = await getJson<{ markets: PendleMarket[] }>(
    `https://api-v2.pendle.finance/core/v1/${chainId}/markets/active`,
  );
  pendleCache = { at: Date.now(), markets: body.markets };
  return body.markets;
}

/**
 * Fixed yield of a Pendle PT, looked up by the PT's on-chain address. When a PT matures and
 * Neverland lists the next one, the new address is picked up automatically.
 */
export function pendlePt(chainId = 143) {
  return async ({ address }: YieldContext): Promise<number | null> => {
    if (!address) return null;
    const markets = await pendleMarkets(chainId);
    const m = markets.find((x) => x.pt.toLowerCase() === `${chainId}-${address}`.toLowerCase());
    return m ? m.details.impliedApy : null;
  };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Reads the maturity from a Pendle PT symbol, e.g. "PT-AUSD-8OCT2026" → "2026-10-08". */
export function ptMaturityFromSymbol(symbol: string): string | undefined {
  const m = /-(\d{1,2})([A-Z]{3})(\d{4})$/i.exec(symbol);
  if (!m) return undefined;
  const month = MONTHS.indexOf(m[2].toUpperCase());
  if (month < 0) return undefined;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

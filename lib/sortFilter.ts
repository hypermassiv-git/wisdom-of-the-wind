import { getAsset } from "@/config/assets";
import type { RiskLevel, Strategy, StrategyType } from "@/lib/engine/types";

export type SortKey = "yield" | "risk";
export type TypeFilter = StrategyType | "all";

const RISK_ORDER: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };

/** 0 if your money stays in stablecoins, 1 if it moves with a volatile asset's price. */
export function priceExposure(s: Strategy): 0 | 1 {
  return getAsset(s.legs.find((l) => l.role === "deposit")!.symbol)?.family === "USD" ? 0 : 1;
}

/** Days until the nearest PT held in this strategy matures, or null if there's no PT. */
export function daysToMaturity(s: Strategy, now = Date.now()): number | null {
  const hasPt = s.legs.some((l) => l.role !== "borrow" && getAsset(l.symbol)?.builtInYield?.kind === "pt");
  if (!hasPt || !s.vars.maturity) return null;
  return Math.round((Date.parse(s.vars.maturity) - now) / 86_400_000);
}

/** 1 if a PT in this strategy matures within 30 days (its fixed rate is about to end). */
function maturesSoon(s: Strategy): 0 | 1 {
  const d = daysToMaturity(s);
  return d !== null && d <= 30 ? 1 : 0;
}

const borrows = (s: Strategy): 0 | 1 => (s.legs.some((l) => l.role === "borrow") ? 1 : 0);

/**
 * Filters by type, then sorts by best yield (default) or lowest risk: risk level, then stablecoins
 * before volatile assets, then no-loan before borrowing, then PTs about to mature last, then yield.
 */
export function sortAndFilter(list: Strategy[], sort: SortKey, type: TypeFilter): Strategy[] {
  const filtered = type === "all" ? list : list.filter((s) => s.type === type);
  return [...filtered].sort((a, b) =>
    sort === "risk"
      ? RISK_ORDER[a.risk] - RISK_ORDER[b.risk] ||
        priceExposure(a) - priceExposure(b) ||
        borrows(a) - borrows(b) ||
        maturesSoon(a) - maturesSoon(b) ||
        b.netApr - a.netApr
      : b.netApr - a.netApr,
  );
}

/** How many strategies of each type there are (for filter chip counts). */
export function countByType(list: Strategy[]): Partial<Record<StrategyType, number>> {
  const out: Partial<Record<StrategyType, number>> = {};
  for (const s of list) out[s.type] = (out[s.type] ?? 0) + 1;
  return out;
}

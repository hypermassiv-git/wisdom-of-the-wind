/**
 * Neverland's MON incentives, which are paid off-chain through Merkl rather than the
 * on-chain RewardsController. Each Merkl opportunity names the reserve's aToken (or debt
 * token), so rewards are matched to reserves by that address.
 */
import { assetFromOnchainSymbol } from "@/config/assets";
import type { Incentive } from "./types";

const URL = "https://api.merkl.xyz/v4/opportunities?chainId=143&mainProtocolId=neverland&items=100";
const TIMEOUT_MS = 8_000;

export interface MerklOpportunity {
  status: string;
  action: string;
  /** Percent, e.g. 3 = 3%. */
  apr: number;
  /** The reserve's aToken (lending) or debt token (borrowing). */
  explorerAddress?: string;
  rewardsRecord?: {
    breakdowns: { token: { symbol: string; price?: number | null }; value: number }[];
  };
}

export interface MerklIncentives {
  /** aToken address (lowercase) → incentives for depositors. */
  supply: Map<string, Incentive[]>;
  /** Debt token address (lowercase) → incentives for borrowers. */
  borrow: Map<string, Incentive[]>;
}

export async function fetchMerklOpportunities(): Promise<MerklOpportunity[]> {
  const res = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`${URL} → ${res.status}`);
  return res.json() as Promise<MerklOpportunity[]>;
}

/** "nWMON" → "MON", "WMON" → "MON", otherwise the asset's display name. */
function rewardSymbol(symbol: string): string {
  const asset = assetFromOnchainSymbol(symbol) ?? (symbol.startsWith("n") ? assetFromOnchainSymbol(symbol.slice(1)) : undefined);
  return asset?.display ?? symbol;
}

/** Adds incentives together, summing rates for the same token. */
export function mergeIncentives(...lists: Incentive[][]): Incentive[] {
  const byToken = new Map<string, number>();
  for (const list of lists) for (const i of list) byToken.set(i.token, (byToken.get(i.token) ?? 0) + i.apr);
  return [...byToken].map(([token, apr]) => ({ token, apr }));
}

export function merklIncentives(opps: MerklOpportunity[]): MerklIncentives {
  const out: MerklIncentives = { supply: new Map(), borrow: new Map() };
  for (const o of opps) {
    if (o.status !== "LIVE" || !(o.apr > 0) || !o.explorerAddress) continue;
    const breakdowns = o.rewardsRecord?.breakdowns ?? [];
    const total = breakdowns.reduce((sum, b) => sum + (b.value || 0), 0);
    if (total <= 0) continue;
    // Merkl's APR covers all reward tokens; split it by each token's share of the value.
    // Unpriced rewards (e.g. points) carry no value and drop out.
    const incentives = breakdowns
      .filter((b) => b.token.price && b.value > 0)
      .map((b) => ({ token: rewardSymbol(b.token.symbol), apr: (o.apr / 100) * (b.value / total) }));
    const map = o.action === "BORROW" ? out.borrow : out.supply;
    const key = o.explorerAddress.toLowerCase();
    map.set(key, mergeIncentives(map.get(key) ?? [], incentives));
  }
  return out;
}

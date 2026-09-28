import type { MarketSnapshot } from "@/lib/data/types";
import type { Strategy } from "@/lib/engine/types";

export interface StrategiesResponse {
  fetchedAt: string;
  source: "mock" | "live";
  stale: boolean;
  dustPriceUsd: number;
  principalUsd: number;
  minNetApr: number;
  strategies: Strategy[];
  snapshot: MarketSnapshot;
}

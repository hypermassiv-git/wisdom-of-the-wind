import "server-only";
import { getDataMode } from "@/config/engine";
import { mockSnapshot } from "./mock";
import type { MarketSnapshot } from "./types";

const CACHE_MS = 60_000;

let cached: { at: number; snapshot: MarketSnapshot } | null = null;
let lastGood: MarketSnapshot | null = null;
let inflight: Promise<MarketSnapshot> | null = null;

/**
 * Returns market data, shared by all visitors for up to a minute so the RPC is hit at most
 * about once a minute. If a live read fails, the last good snapshot is returned marked stale.
 */
export async function getSnapshot(): Promise<MarketSnapshot> {
  if (getDataMode() === "mock") return mockSnapshot();

  if (cached && Date.now() - cached.at < CACHE_MS) return cached.snapshot;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { fetchLiveSnapshot } = await import("./onchain");
      const snapshot = await fetchLiveSnapshot();
      cached = { at: Date.now(), snapshot };
      lastGood = snapshot;
      return snapshot;
    } catch (err) {
      console.error("[data] live fetch failed:", err);
      if (lastGood) return { ...lastGood, stale: true };
      throw err;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

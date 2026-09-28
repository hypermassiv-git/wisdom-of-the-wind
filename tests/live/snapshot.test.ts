/**
 * Smoke test against real Monad data. Run with `npm run check:live` (needs MONAD_RPC_URL).
 * Prints the snapshot summary and the ranked strategies.
 */
import { expect, test } from "vitest";
import { fetchLiveSnapshot } from "@/lib/data/onchain";
import { runEngine } from "@/lib/engine";

test("reads all three markets and ranks strategies", async () => {
  const s = await fetchLiveSnapshot();
  expect(s.markets.map((m) => m.id)).toEqual(["main", "pt-ausd", "pt-shmon", "syzusd"]);
  expect(s.dustPriceUsd).toBeGreaterThan(0);
  for (const m of s.markets) expect(m.reserves.length).toBeGreaterThan(1);

  console.log("DUST $", s.dustPriceUsd.toFixed(4));
  console.log("built-in yields", s.builtInYields, "live:", s.builtInYieldsLive, "maturities:", s.maturities);
  for (const x of runEngine(s))
    console.log(`${(x.netApr * 100).toFixed(1)}%  ${x.risk.padEnd(6)} ${x.rewardDriven ? "RD" : "  "}  ${x.text.name}`);
});

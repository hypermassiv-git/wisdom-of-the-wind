import { describe, expect, test } from "vitest";
import { type MerklOpportunity, mergeIncentives, merklIncentives } from "@/lib/data/merkl";

const NUSDC = "0x38648958836eA88b368b4ac23b86Ad44B0fe7508";
const NPWMON = "0xe0fDCBB0855f950dDf5f21595383f7f2a173E01e";
const nWMON = { symbol: "nWMON", price: 0.0274 };

// Trimmed from the live Merkl API (chainId 143, protocol neverland).
const OPPS: MerklOpportunity[] = [
  { status: "LIVE", action: "LEND", apr: 3, explorerAddress: NUSDC, rewardsRecord: { breakdowns: [{ token: nWMON, value: 124.7 }] } },
  { status: "LIVE", action: "LEND", apr: 2, explorerAddress: NUSDC, rewardsRecord: { breakdowns: [{ token: nWMON, value: 50 }] } },
  { status: "PAST", action: "LEND", apr: 5, explorerAddress: NUSDC, rewardsRecord: { breakdowns: [] } },
  {
    status: "LIVE",
    action: "LEND",
    apr: 4,
    explorerAddress: NPWMON,
    rewardsRecord: {
      breakdowns: [
        { token: nWMON, value: 80 },
        { token: { symbol: "shMON Points", price: null }, value: 0 },
      ],
    },
  },
  {
    status: "LIVE",
    action: "LEND",
    apr: 0,
    explorerAddress: "0xC64d73Bb8748C6fA7487ace2D0d945B6fBb2EcDe",
    rewardsRecord: { breakdowns: [{ token: { symbol: "shMON Points", price: null }, value: 0 }] },
  },
];

describe("merklIncentives", () => {
  const m = merklIncentives(OPPS);

  test("sums live campaigns on the same aToken and skips past ones", () => {
    expect(m.supply.get(NUSDC.toLowerCase())).toEqual([{ token: "MON", apr: expect.closeTo(0.05, 10) }]);
  });

  test("maps nWMON to MON and ignores unpriced points", () => {
    expect(m.supply.get(NPWMON.toLowerCase())).toEqual([{ token: "MON", apr: expect.closeTo(0.04, 10) }]);
  });

  test("drops zero-APR opportunities", () => {
    expect(m.supply.size).toBe(2);
    expect(m.borrow.size).toBe(0);
  });

  test("files borrow campaigns under the debt token", () => {
    const b = merklIncentives([
      { status: "LIVE", action: "BORROW", apr: 1, explorerAddress: "0xABC", rewardsRecord: { breakdowns: [{ token: { symbol: "WMON", price: 0.03 }, value: 1 }] } },
    ]);
    expect(b.borrow.get("0xabc")).toEqual([{ token: "MON", apr: 0.01 }]);
  });
});

test("mergeIncentives sums the same token", () => {
  expect(mergeIncentives([{ token: "DUST", apr: 0.01 }, { token: "MON", apr: 0.01 }], [{ token: "MON", apr: 0.02 }])).toEqual([
    { token: "DUST", apr: 0.01 },
    { token: "MON", apr: 0.03 },
  ]);
});

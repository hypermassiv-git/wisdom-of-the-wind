import { afterEach, describe, expect, it, vi } from "vitest";
import { appSymbol, assetFromOnchainSymbol, displayName, getAsset, resolveBuiltInYields } from "@/config/assets";
import { ptMaturityFromSymbol } from "@/lib/data/yieldSources";

describe("assetFromOnchainSymbol", () => {
  it("matches Pendle PTs by prefix regardless of maturity", () => {
    expect(assetFromOnchainSymbol("PT-AUSD-8OCT2026")?.symbol).toBe("PT-AUSD");
    expect(assetFromOnchainSymbol("PT-shMON-18MAR2027")?.symbol).toBe("PT-shMON");
    expect(assetFromOnchainSymbol("PT-earnAUSD-8OCT2026")).toBeUndefined();
  });

  it("matches plain symbols exactly, case-insensitively", () => {
    expect(assetFromOnchainSymbol("wmon")?.symbol).toBe("WMON");
    expect(assetFromOnchainSymbol("loAZND")).toBeUndefined();
  });
});

describe("PT symbols", () => {
  it("keep their maturity so an old and a rolled PT stay separate", () => {
    expect(appSymbol("PT-AUSD-8OCT2026")).toBe("PT-AUSD-8OCT2026");
    expect(appSymbol("PT-AUSD-17DEC2026")).toBe("PT-AUSD-17DEC2026");
    expect(appSymbol("WMON")).toBe("WMON");
    expect(getAsset("PT-AUSD-17DEC2026")?.symbol).toBe("PT-AUSD");
    expect(displayName("PT-AUSD-17DEC2026")).toBe("PT-AUSD (Dec 17)");
    expect(displayName("PT-AUSD")).toBe("PT-AUSD");
  });
});

describe("ptMaturityFromSymbol", () => {
  it("parses the date suffix", () => {
    expect(ptMaturityFromSymbol("PT-AUSD-8OCT2026")).toBe("2026-10-08");
    expect(ptMaturityFromSymbol("PT-shMON-18MAR2027")).toBe("2027-03-18");
    expect(ptMaturityFromSymbol("shMON")).toBeUndefined();
  });
});

describe("resolveBuiltInYields", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses live values when sources respond", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("pendle")
            ? { markets: [{ pt: "143-0xabc", expiry: "", details: { impliedApy: 0.2 } }] }
            : { data: [{ apy: 9, apyBase: 8 }] },
      })),
    );
    const { yields, live } = await resolveBuiltInYields({ "PT-AUSD": "0xABC" });
    expect(yields.shMON).toBeCloseTo(0.08); // apyBase, as a decimal
    expect(yields["PT-AUSD"]).toBeCloseTo(0.2);
    expect(live["PT-AUSD"]).toBe(true);
    expect(live["PT-shMON"]).toBe(false); // no address given → fallback
  });

  it("prices each listed PT separately, and a matured one at 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ markets: [{ pt: "143-0xnew", expiry: "", details: { impliedApy: 0.06 } }], data: [] }),
      })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { yields } = await resolveBuiltInYields({ "PT-AUSD-8OCT2020": "0xold", "PT-AUSD-17DEC2099": "0xnew" });
    expect(yields["PT-AUSD-17DEC2099"]).toBeCloseTo(0.06);
    expect(yields["PT-AUSD-8OCT2020"]).toBe(0);
    expect("PT-AUSD" in yields).toBe(false);
  });

  it("falls back to config values when sources fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { yields, live } = await resolveBuiltInYields();
    expect(yields.shMON).toBeGreaterThan(0);
    expect(Object.values(live).every((v) => v === false)).toBe(true);
  });
});

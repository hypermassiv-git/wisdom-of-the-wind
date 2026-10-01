/**
 * Live data reader for Neverland (Aave V3 fork) on Monad.
 * Everything is derived from each market's PoolAddressesProvider plus the DUST/USDC pair.
 */
import "server-only";
import { type Address, createPublicClient, fallback, http, type PublicClient, webSocket, zeroAddress } from "viem";
import { monad } from "viem/chains";
import { assetFromOnchainSymbol, resolveBuiltInYields } from "@/config/assets";
import { DUST, getRpcUrl, type MarketAddresses, MARKETS, missingLiveConfig } from "@/config/chain";
import {
  addressesProviderAbi,
  aTokenAbi,
  dataProviderAbi,
  erc20Abi,
  oracleAbi,
  poolAbi,
  rateStrategyV1Abi,
  rateStrategyV2Abi,
  rewardsControllerAbi,
  uniV2PairAbi,
} from "./abis";
import { fetchMerklOpportunities, type MerklIncentives, mergeIncentives, merklIncentives } from "./merkl";
import { emissionApr, rayToApy, v2SpotPrice } from "./rates";
import { latestPtPerSymbol, ptMaturityFromSymbol } from "./yieldSources";
import type { EMode, Incentive, Market, MarketSnapshot, RateModel, Reserve } from "./types";

interface RawReward {
  token: Address;
  symbol: string;
  decimals: number;
  emissionPerSecond: bigint;
  distributionEnd: bigint;
}

interface RawReserve {
  underlying: Address;
  aToken: Address;
  debtToken: Address;
  symbol: string;
  onchainSymbol: string;
  decimals: number;
  ltv: number;
  liquidationThreshold: number;
  usageAsCollateral: boolean;
  borrowingEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
  paused: boolean;
  totalAToken: bigint;
  totalVariableDebt: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  borrowCap: bigint;
  supplyCap: bigint;
  priceUsd: number;
  eModeId?: number;
  rateModel?: RateModel;
  supplyRewards: RawReward[];
  borrowRewards: RawReward[];
}

type Client = PublicClient;

function ok<T>(r: { status: "success"; result: T } | { status: "failure"; error: Error }): T | undefined {
  return r.status === "success" ? r.result : undefined;
}

async function readMarket(client: Client, m: MarketAddresses) {
  const provider = m.poolAddressesProvider!;
  const [pool, oracle, dataProvider] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: provider, abi: addressesProviderAbi, functionName: "getPool" },
      { address: provider, abi: addressesProviderAbi, functionName: "getPriceOracle" },
      { address: provider, abi: addressesProviderAbi, functionName: "getPoolDataProvider" },
    ],
  });

  const assets = await client.readContract({ address: pool, abi: poolAbi, functionName: "getReservesList" });

  const [prices, baseUnit] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: oracle, abi: oracleAbi, functionName: "getAssetsPrices", args: [assets] },
      { address: oracle, abi: oracleAbi, functionName: "BASE_CURRENCY_UNIT" },
    ],
  });

  const perAsset = await Promise.all(
    assets.map((asset) =>
      client.multicall({
        contracts: [
          { address: asset, abi: erc20Abi, functionName: "symbol" },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getReserveConfigurationData", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getReserveData", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getReserveTokensAddresses", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getReserveCaps", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getPaused", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getReserveEModeCategory", args: [asset] },
          { address: dataProvider, abi: dataProviderAbi, functionName: "getInterestRateStrategyAddress", args: [asset] },
        ],
      }),
    ),
  );

  const parsed = await Promise.all(
    assets.map(async (underlying, i): Promise<RawReserve | null> => {
      const [sym, conf, data, tokens, caps, paused, emode, strategy] = perAsset[i];
      const symbol = ok(sym);
      const c = ok(conf);
      const d = ok(data);
      const t = ok(tokens);
      if (!symbol || !c || !d || !t) return null;
      const asset = assetFromOnchainSymbol(symbol);
      if (!asset) {
        console.warn(`[onchain] ${m.id}: skipping unknown asset ${symbol} (${underlying}). Add it to config/assets.ts.`);
        return null;
      }
      const [aToken, , vDebt] = t;
      const [supplyRewards, borrowRewards, model] = await Promise.all([
        readRewards(client, aToken),
        readRewards(client, vDebt),
        readRateModel(client, ok(strategy), underlying),
      ]);
      const emodeId = ok(emode);
      const capsRes = ok(caps);
      return {
        underlying,
        aToken,
        debtToken: vDebt,
        symbol: asset.symbol,
        onchainSymbol: symbol,
        decimals: Number(c[0]),
        ltv: Number(c[1]) / 1e4,
        liquidationThreshold: Number(c[2]) / 1e4,
        usageAsCollateral: c[5],
        borrowingEnabled: c[6],
        isActive: c[8],
        isFrozen: c[9],
        paused: ok(paused) ?? false,
        totalAToken: d[2],
        totalVariableDebt: d[4],
        liquidityRate: d[5],
        variableBorrowRate: d[6],
        borrowCap: capsRes?.[0] ?? 0n,
        supplyCap: capsRes?.[1] ?? 0n,
        priceUsd: Number(prices[i]) / Number(baseUnit),
        eModeId: emodeId && emodeId > 0n ? Number(emodeId) : undefined,
        rateModel: model ? { ...model, reserveFactor: Number(c[4]) / 1e4 } : undefined,
        supplyRewards,
        borrowRewards,
      };
    }),
  );
  const reserves = latestPtPerSymbol(parsed.filter((r): r is RawReserve => r !== null));

  const eModes = await readEModes(client, pool, reserves);
  return { config: m, reserves, eModes };
}

const RAY_NUM = 1e27;

/** Reads a reserve's rate curve. Supports both Aave 3.0/3.1 and 3.2+ strategy contracts. */
async function readRateModel(
  client: Client,
  strategy: Address | undefined,
  asset: Address,
): Promise<Omit<RateModel, "reserveFactor"> | null> {
  if (!strategy || strategy === zeroAddress) return null;
  const v1 = await client.multicall({
    contracts: [
      { address: strategy, abi: rateStrategyV1Abi, functionName: "getBaseVariableBorrowRate" },
      { address: strategy, abi: rateStrategyV1Abi, functionName: "getVariableRateSlope1" },
      { address: strategy, abi: rateStrategyV1Abi, functionName: "getVariableRateSlope2" },
      { address: strategy, abi: rateStrategyV1Abi, functionName: "OPTIMAL_USAGE_RATIO" },
    ],
  });
  if (v1.every((r) => r.status === "success")) {
    const [b, s1, s2, opt] = v1.map((r) => Number(r.result as bigint) / RAY_NUM);
    return { baseRate: b, slope1: s1, slope2: s2, optimalUsage: opt };
  }
  try {
    const d = await client.readContract({
      address: strategy,
      abi: rateStrategyV2Abi,
      functionName: "getInterestRateDataBps",
      args: [asset],
    });
    return {
      baseRate: d.baseVariableBorrowRate / 1e4,
      slope1: d.variableRateSlope1 / 1e4,
      slope2: d.variableRateSlope2 / 1e4,
      optimalUsage: d.optimalUsageRatio / 1e4,
    };
  } catch {
    return null;
  }
}

async function readRewards(client: Client, token: Address): Promise<RawReward[]> {
  if (token === zeroAddress) return [];
  let controller: Address;
  try {
    controller = await client.readContract({ address: token, abi: aTokenAbi, functionName: "getIncentivesController" });
  } catch {
    return [];
  }
  if (controller === zeroAddress) return [];
  const rewards = await client.readContract({
    address: controller,
    abi: rewardsControllerAbi,
    functionName: "getRewardsByAsset",
    args: [token],
  });
  return Promise.all(
    rewards.map(async (reward) => {
      const [data, symbol, decimals] = await client.multicall({
        allowFailure: false,
        contracts: [
          { address: controller, abi: rewardsControllerAbi, functionName: "getRewardsData", args: [token, reward] },
          { address: reward, abi: erc20Abi, functionName: "symbol" },
          { address: reward, abi: erc20Abi, functionName: "decimals" },
        ],
      });
      return { token: reward, symbol, decimals, emissionPerSecond: data[1], distributionEnd: data[3] };
    }),
  );
}

async function readEModes(client: Client, pool: Address, reserves: RawReserve[]): Promise<EMode[]> {
  const ids = [...new Set(reserves.map((r) => r.eModeId).filter((x): x is number => x !== undefined))];
  if (!ids.length) return [];
  const res = await client.multicall({
    contracts: ids.map((id) => ({ address: pool, abi: poolAbi, functionName: "getEModeCategoryData" as const, args: [id] as const })),
  });
  return ids.flatMap((id, i) => {
    const r = ok(res[i]);
    if (!r || r.ltv === 0) return [];
    return [{ id, label: r.label, ltv: r.ltv / 1e4, liquidationThreshold: r.liquidationThreshold / 1e4 }];
  });
}

async function readDustPrice(client: Client): Promise<number> {
  const pair = DUST.usdcPair!;
  const [reserves, token0, token1] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: pair, abi: uniV2PairAbi, functionName: "getReserves" },
      { address: pair, abi: uniV2PairAbi, functionName: "token0" },
      { address: pair, abi: uniV2PairAbi, functionName: "token1" },
    ],
  });
  const dustIs0 = token0.toLowerCase() === DUST.token!.toLowerCase();
  const [d0, d1] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: token0, abi: erc20Abi, functionName: "decimals" },
      { address: token1, abi: erc20Abi, functionName: "decimals" },
    ],
  });
  return v2SpotPrice({
    reserveBase: dustIs0 ? reserves[0] : reserves[1],
    reserveQuote: dustIs0 ? reserves[1] : reserves[0],
    baseDecimals: dustIs0 ? d0 : d1,
    quoteDecimals: dustIs0 ? d1 : d0,
  });
}

function amountUsd(amount: bigint, decimals: number, price: number): number {
  return (Number(amount) / 10 ** decimals) * price;
}

function toIncentives(
  rewards: RawReward[],
  poolValueUsd: number,
  priceByToken: Map<string, number>,
  now: number,
): Incentive[] {
  return rewards.flatMap((r) => {
    const price = priceByToken.get(r.token.toLowerCase());
    if (price === undefined) {
      console.warn(`[onchain] no price for reward token ${r.symbol} (${r.token}); ignoring it`);
      return [];
    }
    const apr = emissionApr({
      emissionPerSecond: r.emissionPerSecond,
      rewardDecimals: r.decimals,
      rewardPriceUsd: price,
      poolValueUsd,
      distributionEnd: Number(r.distributionEnd),
      nowSeconds: now,
    });
    const isDust = r.token.toLowerCase() === DUST.token!.toLowerCase();
    const token = isDust ? "DUST" : (assetFromOnchainSymbol(r.symbol)?.display ?? r.symbol);
    return apr > 0 ? [{ token, apr }] : [];
  });
}

function toReserve(
  r: RawReserve,
  priceByToken: Map<string, number>,
  merkl: MerklIncentives,
  now: number,
): Reserve {
  const supplyUsd = amountUsd(r.totalAToken, r.decimals, r.priceUsd);
  const debtUsd = amountUsd(r.totalVariableDebt, r.decimals, r.priceUsd);
  const supplyCapUsd = Number(r.supplyCap) * r.priceUsd;
  const borrowCapUsd = Number(r.borrowCap) * r.priceUsd;
  const live = r.isActive && !r.isFrozen && !r.paused;
  let available = Math.max(0, supplyUsd - debtUsd);
  if (r.borrowCap > 0n) available = Math.min(available, Math.max(0, borrowCapUsd - debtUsd));

  return {
    symbol: r.symbol,
    supplyRate: rayToApy(r.liquidityRate),
    borrowRate: rayToApy(r.variableBorrowRate),
    ltv: r.ltv,
    liquidationThreshold: r.liquidationThreshold,
    canBorrow: live && r.borrowingEnabled && (r.borrowCap === 0n || debtUsd < borrowCapUsd),
    canCollateral: r.usageAsCollateral && r.ltv > 0,
    canSupply: live && (r.supplyCap === 0n || supplyUsd < supplyCapUsd * 0.999),
    priceUsd: r.priceUsd,
    totalSupplyUsd: supplyUsd,
    totalDebtUsd: debtUsd,
    availableLiquidityUsd: available,
    supplyCapUsd: r.supplyCap > 0n ? supplyCapUsd : undefined,
    borrowCapUsd: r.borrowCap > 0n ? borrowCapUsd : undefined,
    rateModel: r.rateModel,
    supplyIncentives: mergeIncentives(
      toIncentives(r.supplyRewards, supplyUsd, priceByToken, now),
      merkl.supply.get(r.aToken.toLowerCase()) ?? [],
    ),
    borrowIncentives: mergeIncentives(
      toIncentives(r.borrowRewards, debtUsd, priceByToken, now),
      merkl.borrow.get(r.debtToken.toLowerCase()) ?? [],
    ),
    eModeId: r.eModeId,
  };
}

export async function fetchLiveSnapshot(): Promise<MarketSnapshot> {
  const missing = missingLiveConfig();
  if (missing.length) throw new Error(`Live mode is missing config: ${missing.join(", ")}`);

  // Your RPC first; Monad's public RPC as a backup if it's down or times out.
  const url = getRpcUrl()!;
  const primary = url.startsWith("ws") ? webSocket(url, { timeout: 10_000 }) : http(url, { timeout: 10_000 });
  const transport = fallback([primary, http(undefined, { timeout: 10_000 })]);
  const client = createPublicClient({ chain: monad, transport }) as Client;
  const [dustPriceUsd, raw, merklOpps] = await Promise.all([
    readDustPrice(client),
    Promise.all(MARKETS.map((m) => readMarket(client, m))),
    // MON incentives come from Merkl. If it's down, show on-chain rewards only.
    fetchMerklOpportunities().catch((err) => {
      console.warn("[onchain] Merkl fetch failed; MON incentives left out:", err);
      return [];
    }),
  ]);
  const merkl = merklIncentives(merklOpps);

  const addresses: Record<string, string> = {};
  const maturities: Record<string, string> = {};
  for (const m of raw)
    for (const r of m.reserves) {
      addresses[r.symbol] = r.underlying;
      const maturity = ptMaturityFromSymbol(r.onchainSymbol);
      if (maturity) maturities[r.symbol] = maturity;
    }
  const { yields: builtInYields, live: builtInYieldsLive } = await resolveBuiltInYields(addresses);

  // Reward tokens are priced from the protocol oracle when listed, DUST from its Uniswap pair.
  const priceByToken = new Map<string, number>();
  for (const m of raw) for (const r of m.reserves) priceByToken.set(r.underlying.toLowerCase(), r.priceUsd);
  priceByToken.set(DUST.token!.toLowerCase(), dustPriceUsd);

  const now = Math.floor(Date.now() / 1000);
  const markets: Market[] = raw.map(({ config, reserves, eModes }) => ({
    id: config.id,
    name: config.name,
    kind: config.kind,
    eModes,
    reserves: reserves.map((r) => toReserve(r, priceByToken, merkl, now)),
  }));

  return {
    source: "live",
    fetchedAt: new Date().toISOString(),
    dustPriceUsd,
    builtInYields,
    builtInYieldsLive,
    maturities,
    markets,
  };
}

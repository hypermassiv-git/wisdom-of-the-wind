/**
 * "Main risk" text, chosen per strategy so each card leads with the risk that matters most for it
 * (price exposure, borrow rates, a stablecoin losing its $1 price, leaving a PT early, liquidation…)
 * rather than repeating liquidation everywhere. All figures come from live rates.
 */
import { displayName, getAsset, type PriceFamily } from "@/config/assets";
import type { EngineConfig } from "@/config/engine";
import { formatDate, pct, usd } from "@/lib/format";
import type { Candidate, Earnings, Leg } from "./types";

const PRICE_NAME: Record<PriceFamily, string> = { MON: "MON", BTC: "bitcoin", ETH: "ether", GOLD: "gold", USD: "the dollar" };

/** "about 4 months" / "about 1.3 years" of earnings to make back `loss`. */
function payback(loss: number, yearly: number): string {
  if (yearly <= 0) return "a long time";
  const years = loss / yearly;
  if (years < 1) return `about ${Math.max(1, Math.round(years * 12))} months`;
  return `about ${years.toFixed(1)} years`;
}

interface Ctx {
  c: Candidate;
  deposit: Leg;
  borrow?: Leg;
  lend?: Leg;
  principal: number;
  net: number;
  spread: Earnings;
  maturity: string;
  maturityIso?: string;
}

/** One risk, as structured data for icons and chips; `detail` is also used in the written main risk. */
export type RiskKind = "price" | "borrowRate" | "rateGap" | "maturity" | "liquidation" | "peg" | "lockup" | "rewards" | "safe";

export interface RiskFactor {
  kind: RiskKind;
  /** Short chip label, e.g. "MON price". */
  label: string;
  /** Tiny figure shown under the label, e.g. "−30% ≈ −$300". */
  stat?: string;
  /** One or two plain sentences. */
  detail: string;
  /** The main risk for this strategy. */
  lead?: boolean;
}

/** Dollar exposure to a volatile asset, worded per strategy so cards don't all read the same. */
function priceExposure(x: Ctx, style: "loop" | "gap" | "hold"): RiskFactor {
  const name = PRICE_NAME[getAsset(x.deposit.symbol)!.family];
  const d = displayName(x.deposit.symbol);
  const loss = x.principal * 0.3;
  const left = usd(x.principal - loss);
  const back = payback(loss, x.net);
  const detail =
    style === "loop"
      ? `Looping ${d} makes this as much a bet on ${name} as a yield play: if ${name} drops 30%, your ${usd(
          x.principal,
        )} is worth about ${left}, and it would take ${back} of earnings to make that back.`
      : style === "gap"
        ? `Your ${d} deposit keeps your ${usd(x.principal)} tied to ${name}'s price, so a 30% ${name} drop would leave it worth about ${left}, a loss that would take ${back} of earnings to recover.`
        : `Holding ${d} means your ${usd(x.principal)} moves with ${name}: a 30% drop would leave about ${left}, which takes ${back} of earnings to recover.`;
  const label = name === "MON" ? "MON price" : `${name[0].toUpperCase()}${name.slice(1)} price`;
  return { kind: "price", label, stat: `−30% ≈ −${usd(loss)}`, detail };
}

/** Borrow rate at which the borrowed part stops paying for itself (rewards included). */
function breakevenRate({ borrow, spread }: Ctx): number {
  return borrow!.baseRate + spread.net / borrow!.amountUsd;
}

function borrowRateRisk(x: Ctx, lead: boolean): RiskFactor {
  const b = displayName(x.borrow!.symbol);
  const be = breakevenRate(x);
  const detail = lead
    ? `The ${b} borrow rate is ${pct(x.borrow!.baseRate)} today. If it climbs past about ${pct(
        be,
      )}, the borrowed part stops paying for itself, and borrow rates can jump quickly when many people borrow at once.`
    : `If the ${b} borrow rate climbs past about ${pct(be)} (it's ${pct(x.borrow!.baseRate)} today), borrowing stops paying for itself.`;
  return { kind: "borrowRate", label: "Borrow rate", stat: `${pct(x.borrow!.baseRate)} now, ${pct(be, 0)} max`, detail };
}

function rateGap(x: Ctx): RiskFactor {
  const b = displayName(x.borrow!.symbol);
  const be = breakevenRate(x);
  return {
    kind: "rateGap",
    label: "Rate gap",
    stat: `pays while under ${pct(be, 0)}`,
    detail: `The rate gap can close at any time: if ${b}'s borrow rate in the ${x.borrow!.marketName.replace(
      " isolated",
      "",
    )} climbs past about ${pct(be)}, this stops paying.`,
  };
}

function ptEarlyExit(symbol: string, maturity: string, maturityIso?: string): RiskFactor {
  const days = maturityIso ? Math.round((Date.parse(maturityIso) - Date.now()) / 86_400_000) : Infinity;
  const short = maturityIso
    ? new Date(maturityIso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : "";
  const soon = days <= 90;
  const detail = soon
    ? `${displayName(symbol)} matures on ${maturity}${
        days > 0 ? `, in about ${days} days` : ""
      }. Its fixed rate stops then, so these yearly figures only hold until that date unless you move into the next ${displayName(
        symbol,
      )}.`
    : `${displayName(symbol)} only reaches its full value on ${maturity}; leaving earlier means selling at the market price, which can be below what you paid.`;
  return {
    kind: "maturity",
    label: short ? `Matures ${short}` : "Maturity",
    stat: soon && days > 0 ? `in ${days} days` : "exit early at market price",
    detail,
  };
}

function liquidationDrop(x: Ctx): string {
  return pct(Math.max(0, 1 - 1 / x.c.safetyScore), 0);
}

function stablecoinSlip(x: Ctx): RiskFactor {
  const d = displayName(x.deposit.symbol);
  const b = displayName(x.borrow!.symbol);
  return {
    kind: "peg",
    label: "$1 peg",
    stat: d === b ? d : `${d} & ${b}`,
    detail:
      d === b
        ? `It also relies on ${d} holding its $1 price.`
        : `It also relies on both ${d} and ${b} holding $1; a serious slip in either could put your deposit at risk of liquidation.`,
  };
}

function tiedUp(market: string): RiskFactor {
  return {
    kind: "lockup",
    label: "Withdrawal wait",
    stat: "if the market is busy",
    detail: `Money lent in the ${market.replace(" isolated", "")} can be briefly stuck if most of it is borrowed.`,
  };
}

function isPt(symbol: string): boolean {
  return getAsset(symbol)?.builtInYield?.kind === "pt";
}

const NO_LOAN: RiskFactor = {
  kind: "safe",
  label: "No liquidation",
  stat: "nothing borrowed",
  detail: "Nothing is borrowed, so nothing can be liquidated.",
};

/** Main risks in order: [lead, second]. Their details make up the written "Main risk". */
function coreRisks(x: Ctx): RiskFactor[] {
  const { c, deposit } = x;
  const asset = getAsset(deposit.symbol)!;
  const name = displayName(deposit.symbol);

  if (!x.borrow) {
    if (asset.family !== "USD") {
      const extra = isPt(deposit.symbol)
        ? ptEarlyExit(deposit.symbol, x.maturity, x.maturityIso)
        : asset.builtInYield?.kind === "lst"
          ? { ...NO_LOAN, detail: `${name} can also drift slightly against MON. ${NO_LOAN.detail}` }
          : NO_LOAN;
      return extra.kind === "safe" ? [priceExposure(x, "hold"), extra] : [priceExposure(x, "hold"), extra, NO_LOAN];
    }
    if (isPt(deposit.symbol)) return [ptEarlyExit(deposit.symbol, x.maturity, x.maturityIso), NO_LOAN];
    const peg: RiskFactor = { kind: "peg", label: "$1 peg", stat: name, detail: `The main risk is ${name} losing its $1 price.` };
    return deposit.marketKind === "isolated" ? [peg, NO_LOAN, tiedUp(deposit.marketName)] : [peg, NO_LOAN];
  }

  const volatileDeposit = asset.family !== "USD";
  const lentInIsolated =
    x.lend && x.lend.marketKind === "isolated" && !isPt(x.lend.symbol) ? tiedUp(x.lend.marketName) : null;
  const ptDeposit = isPt(deposit.symbol) ? ptEarlyExit(deposit.symbol, x.maturity, x.maturityIso) : null;

  switch (c.type) {
    case "collateralCarry": {
      const family = PRICE_NAME[asset.family];
      const drop = liquidationDrop(x);
      return [
        {
          kind: "liquidation",
          label: `Liquidation at −${drop}`,
          stat: `if ${family} falls ${drop}`,
          detail: `If ${family} falls about ${drop} (your ${usd(x.principal)} of ${name} worth under ${usd(
            x.principal / c.safetyScore,
          )}), part of it is sold to repay the ${displayName(x.borrow.symbol)} loan, with a small penalty (liquidation).`,
        },
        {
          ...priceExposure(x, "hold"),
          detail: `Even before that, your ${usd(x.principal)} still rises and falls with ${family}'s price.`,
        },
      ];
    }
    case "yieldLoop":
      if (volatileDeposit) return [priceExposure(x, "loop"), ptDeposit ?? borrowRateRisk(x, false)];
      return [borrowRateRisk(x, true), ptDeposit ?? stablecoinSlip(x)];
    case "marketGap":
      if (volatileDeposit) return [priceExposure(x, "gap"), rateGap(x)];
      return [rateGap(x), lentInIsolated ?? ptDeposit ?? stablecoinSlip(x)];
    case "stableCarry": {
      const second =
        ptDeposit ??
        lentInIsolated ??
        (x.lend && isPt(x.lend.symbol) ? ptEarlyExit(x.lend.symbol, x.maturity, x.maturityIso) : stablecoinSlip(x));
      return [borrowRateRisk(x, true), second];
    }
    default:
      return [borrowRateRisk(x, true)];
  }
}

function context(c: Candidate, earnings: Earnings, spread: Earnings, config: EngineConfig): Ctx {
  return {
    c,
    deposit: c.legs.find((l) => l.role === "deposit")!,
    borrow: c.legs.find((l) => l.role === "borrow"),
    lend: c.legs.find((l) => l.role === "lend"),
    principal: config.principalUsd,
    net: earnings.net,
    spread,
    maturity: c.vars.maturity ? formatDate(c.vars.maturity) : "its maturity date",
    maturityIso: c.vars.maturity,
  };
}

/** Written "Main risk": the lead risk plus the second one, as sentences. */
export function mainRiskText(c: Candidate, earnings: Earnings, spread: Earnings, config: EngineConfig): string {
  return coreRisks(context(c, earnings, spread, config))
    .slice(0, 2)
    .map((r) => r.detail)
    .join(" ");
}

/** Risk chips for the card: lead first, then the others, then a reward-rate chip where relevant. */
export function riskFactors(
  c: Candidate,
  earnings: Earnings,
  spread: Earnings,
  config: EngineConfig,
  rewardDriven: boolean,
): RiskFactor[] {
  const list: RiskFactor[] = coreRisks(context(c, earnings, spread, config));
  if (rewardDriven) {
    list.push({
      kind: "rewards",
      label: "Reward rates",
      stat: "earnings rely on them",
      detail: "Earnings depend on reward rates staying about where they are.",
    });
  }
  // Keep the "No liquidation" reassurance last so risks come first.
  return [...list.filter((r) => r.kind !== "safe"), ...list.filter((r) => r.kind === "safe")].map((r, i) => ({
    ...r,
    lead: i === 0,
  }));
}

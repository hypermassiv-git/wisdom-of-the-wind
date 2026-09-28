/**
 * Text templates per strategy type. Placeholders in {braces} are filled with live assets and
 * numbers, so explanations always match the current rates. Edit wording here.
 */
import { displayName, getAsset } from "@/config/assets";
import type { EngineConfig } from "@/config/engine";
import { formatDate, listJoin, pct, usd } from "@/lib/format";
import { mainRiskText } from "./risks";
import type { Candidate, Earnings, Leg, StrategyText, StrategyType } from "./types";

interface Templates {
  name: string;
  /** Used instead of name when DUST is what makes the strategy pay. */
  nameRewardDriven?: string;
  action: string;
  /** How the strategy makes money when interest alone pays. */
  whyNow: string;
  /** How the strategy makes money when DUST (and other rewards) are the driver. */
  whyNowRewardDriven: string;
}

export const TEMPLATES: Record<StrategyType, Templates> = {
  simpleDeposit: {
    name: "Deposit {deposit}{marketSuffix}",
    action: "Deposit {deposit} in the {depositMarket} and let it earn. No borrowing needed.",
    whyNow: "Your {principal} of {deposit} earns about {depositTotal} a year{fromSource}{plusDepositRewards}.",
    whyNowRewardDriven: "Your {principal} of {deposit} earns about {depositTotal} a year{fromSource}{plusDepositRewards}.",
  },
  yieldLoop: {
    name: "Boosted {deposit} yield",
    action:
      "Deposit {deposit}, borrow {borrow} against it, {convert} more {deposit} and deposit that too, so about {leverage} times your money ends up earning.",
    whyNow:
      "{deposit} earns about {depositPer1k} a year for every $1,000, while borrowing {borrow} costs only about {borrowPer1k}. Turning borrowed {borrow} into more {deposit} adds about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards both for holding {deposit} and for borrowing {borrow}. Looping makes both bigger, adding about {spreadRewards} a year in {rewardName} on top of what your {principal} earns by itself, while the loan's interest costs about {spreadInterestAbs} more than the borrowed coins earn.",
  },
  marketGap: {
    name: "Borrow {borrow} in the {borrowShort}, lend it in the {lendShort}",
    action:
      "Deposit {deposit} in the {borrowMarket}, borrow {borrow} there, and lend that {borrow} in the {lendMarket}.",
    whyNow:
      "Borrowing {borrow} in the {borrowMarket} costs about {borrowPer1k} a year for every $1,000, but lending it in the {lendMarket} earns about {lendPer1k}. That gap adds about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards to people who borrow {borrow} in the {borrowMarket} and to people who lend it in the {lendMarket}, so you collect on both sides: about {spreadRewards} a year on top of what your {principal} earns by itself, while the loan's interest costs about {spreadInterestAbs} more than the borrowed coins earn.",
  },
  stableCarry: {
    name: "Borrow {borrow}, earn with {lend}{lendSuffix}",
    action: "Deposit {deposit}, borrow {borrow} against it, and {lendAction}.",
    whyNow:
      "Borrowing {borrow} costs about {borrowPer1k} a year for every $1,000, while {lend} earns about {lendPer1k}. Both are stablecoins, so that gap adds about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards for borrowing {borrow} and for holding {lend}, so you collect on both sides: about {spreadRewards} a year on top of what your {principal} earns by itself, while the loan's interest costs about {spreadInterestAbs} more than the borrowed coins earn.",
  },
  collateralCarry: {
    name: "Earn on your {deposit} without selling it",
    action:
      "Deposit {deposit}, borrow {borrow} against it (only {borrowShare} of the maximum), and {lendAction}.",
    whyNow:
      "Your {deposit} keeps earning while you borrow {borrow} against it. Borrowing costs about {borrowPer1k} a year for every $1,000 and {lend} earns about {lendPer1k}, which adds about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Your {deposit} keeps earning while Neverland pays {rewardName} rewards for borrowing {borrow} and for holding {lend}. That adds about {spreadRewards} a year on top of what your {principal} earns by itself, while the loan's interest costs about {spreadInterestAbs} more than the borrowed coins earn.",
  },
};

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in vars)) throw new Error(`Missing template value: ${key}`);
    return vars[key];
  });
}

const CONVERT: Record<string, string> = {
  inApp: "swap it in the Neverland app for",
  swap: "swap it on a DEX for",
  stake: "stake it to get",
  deposit: "put it in the vault to get",
};

function lendAction(borrow: string, lend: string, lendMarket: string): string {
  if (borrow === lend) return `lend it in the ${lendMarket}`;
  const conv = getAsset(lend)?.conversion;
  if (conv === "inApp") return `swap it for ${displayName(lend)} in the Neverland app and deposit it in the ${lendMarket}`;
  const how = conv === "deposit" ? "put it into" : "swap it for";
  return `${how} ${displayName(lend)} and deposit that in the ${lendMarket}`;
}

/** "4.7% in DUST" or "4.7% in DUST + 1.2% in MON" for one leg; "" if it earns no rewards. */
export function legRewardText(leg: Leg, rewardValuation: Record<string, number>): string {
  return leg.incentives
    .filter((i) => i.apr > 0.00005)
    .map((i) => `${pct(i.apr * (rewardValuation[i.token] ?? 1))} in ${i.token}`)
    .join(" + ");
}

/** "PT-shMON isolated market" → "PT-shMON market"; "main pool" stays. */
function shortMarket(name: string): string {
  return name.replace(" isolated", "");
}

export function templateVars(
  c: Candidate,
  earnings: Earnings,
  spread: Earnings,
  config: EngineConfig,
): Record<string, string> {
  const deposit = c.legs.find((l) => l.role === "deposit")!;
  const borrow = c.legs.find((l) => l.role === "borrow");
  const lend = c.legs.find((l) => l.role === "lend");
  const depositAsset = getAsset(deposit.symbol);
  const ptDeposit = depositAsset?.builtInYield?.kind === "pt";
  const tokens = Object.entries(earnings.rewardsByToken)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const rewardName = listJoin(tokens.length ? tokens : ["DUST"]);
  const maturity = c.vars.maturity ? formatDate(c.vars.maturity) : "maturity";
  const depositYield = deposit.baseRate + deposit.builtInRate;
  const builtIn = depositAsset?.builtInYield;

  return {
    principal: usd(config.principalUsd),
    deposit: displayName(deposit.symbol),
    borrow: borrow ? displayName(borrow.symbol) : "",
    lend: lend ? displayName(lend.symbol) : "",
    depositMarket: c.vars.depositMarket,
    borrowShort: shortMarket(c.vars.borrowMarket),
    lendShort: shortMarket(c.vars.lendMarket ?? ""),
    lendSuffix: lend?.marketKind === "isolated" ? ` in the ${shortMarket(lend.marketName)}` : "",
    marketSuffix: deposit.marketKind === "isolated" ? ` in the ${shortMarket(c.vars.depositMarket)}` : "",
    borrowMarket: c.vars.borrowMarket,
    lendMarket: c.vars.lendMarket ?? "",
    depositPer1k: usd(depositYield * 1000),
    borrowPer1k: borrow ? usd(borrow.baseRate * 1000) : "",
    lendPer1k: lend ? usd((lend.baseRate + lend.builtInRate) * 1000) : "",
    depositTotal: usd(depositYield * config.principalUsd),
    fromSource: builtIn && deposit.builtInRate > 0 ? ` from ${builtIn.source}` : "",
    plusDepositRewards:
      earnings.rewards >= 0.5 ? `, plus about ${usd(earnings.rewards)} in ${rewardName} rewards` : "",
    leverage: (deposit.amountUsd / config.principalUsd).toFixed(1),
    convert:
      depositAsset?.conversion === "stake" && depositAsset.stakeWith
        ? `stake it with ${depositAsset.stakeWith} (or swap it on a DEX) to get`
        : (CONVERT[depositAsset?.conversion ?? ""] ?? "convert it into"),
    lendAction: lend && borrow ? lendAction(borrow.symbol, lend.symbol, lend.marketName) : "",
    borrowShare: config.leverageFraction === 0.5 ? "half" : pct(config.leverageFraction, 0),
    maturity,
    rewardName,
    plusDust: spread.rewards >= 0.5 ? `, plus about ${usd(spread.rewards)} more in ${rewardName} rewards` : "",
    ptAsset: ptDeposit ? displayName(deposit.symbol) : "",
    spreadInterest: usd(spread.interest),
    spreadInterestAbs: usd(Math.abs(spread.interest)),
    spreadRewards: usd(spread.rewards),
  };
}

export function renderText(
  c: Candidate,
  earnings: Earnings,
  spread: Earnings,
  rewardDriven: boolean,
  config: EngineConfig,
): StrategyText {
  const t = TEMPLATES[c.type];
  const vars = templateVars(c, earnings, spread, config);
  return {
    name: fill(rewardDriven && t.nameRewardDriven ? t.nameRewardDriven : t.name, vars),
    action: fill(t.action, vars),
    whyNow: fill(rewardDriven ? t.whyNowRewardDriven : t.whyNow, vars),
    mainRisk: mainRiskText(c, earnings, spread, config),
  };
}

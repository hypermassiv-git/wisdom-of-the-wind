/**
 * Text templates per strategy type. Placeholders in {braces} are filled with live assets and
 * numbers, so explanations always match the current rates. Edit wording here.
 */
import { displayName, getAsset } from "@/config/assets";
import type { EngineConfig } from "@/config/engine";
import { formatDate, listJoin, usd } from "@/lib/format";
import { mainRiskText } from "./risks";
import type { Candidate, Earnings, StrategyText, StrategyType } from "./types";

interface Templates {
  name: string;
  /** Used instead of name when rewards (e.g. MON) are what make the strategy pay. */
  nameRewardDriven?: string;
  action: string;
  /** How the strategy makes money when interest alone pays. */
  whyNow: string;
  /** How the strategy makes money when rewards are the driver. */
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
      "You borrow {borrowAmount} of {borrow} in total and turn it into more {deposit}, so you end up with {loopDeposit} of {deposit} deposited instead of {principal}. The extra {deposit} earns about {loopExtraEarn} a year and the loan costs about {borrowCost} a year, so you keep about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards both for holding {deposit} and for borrowing {borrow}. Looping makes both bigger, adding about {spreadRewards} a year in {rewardName} on top of what your {principal} earns by itself. The catch: the interest on the {borrowAmount} loan ({borrowCost} a year) is about {spreadInterestAbs} a year more than the extra {deposit} earns ({loopExtraEarn}).",
  },
  marketGap: {
    name: "Borrow {borrow} in the {borrowShort}, lend it in the {lendShort}",
    action:
      "Deposit {deposit} in the {borrowMarket}, borrow {borrow} there, and lend that {borrow} in the {lendMarket}.",
    whyNow:
      "You borrow {borrowAmount} of {borrow} in the {borrowMarket}, which costs about {borrowCost} a year. You lend that same {borrowAmount} in the {lendMarket}, where it earns about {lendEarn} a year. You keep the difference: about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards to people who borrow {borrow} in the {borrowMarket} and to people who lend it in the {lendMarket}, so you collect on both sides: about {spreadRewards} a year on top of what your {principal} earns by itself. The catch: the interest on the {borrowAmount} loan ({borrowCost} a year) is about {spreadInterestAbs} a year more than lending it earns ({lendEarn}).",
  },
  stableCarry: {
    name: "Borrow {borrow}, earn with {lend}{lendSuffix}",
    action: "Deposit {deposit}, borrow {borrow} against it, and {lendAction}.",
    whyNow:
      "You borrow {borrowAmount} of {borrow}, which costs about {borrowCost} a year. {lendIt} earns about {lendEarn} a year. Both are stablecoins worth about $1, so you keep the difference: about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Neverland pays {rewardName} rewards for borrowing {borrow} and for holding {lend}, so you collect on both sides: about {spreadRewards} a year on top of what your {principal} earns by itself. The catch: the interest on the {borrowAmount} loan ({borrowCost} a year) is about {spreadInterestAbs} a year more than the {lend} earns ({lendEarn}).",
  },
  collateralCarry: {
    name: "Earn on your {deposit} without selling it",
    action:
      "Deposit {deposit}, borrow {borrow} against it (well under the limit), and {lendAction}.",
    whyNow:
      "Your {deposit} keeps earning while you borrow {borrowAmount} of {borrow} against it, which costs about {borrowCost} a year. {lendIt} earns about {lendEarn} a year, so you keep the difference: about {spreadInterest} a year on top of what your {principal} earns by itself{plusDust}.",
    whyNowRewardDriven:
      "Your {deposit} keeps earning while Neverland pays {rewardName} rewards for borrowing {borrow} and for holding {lend}. That adds about {spreadRewards} a year on top of what your {principal} earns by itself. The catch: the interest on the {borrowAmount} loan ({borrowCost} a year) is about {spreadInterestAbs} a year more than the {lend} earns ({lendEarn}).",
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

/** Start of the sentence saying what the borrowed coins earn: "Lent in the …, it" or "Turned into …, it". */
function lendIt(borrow: string, lend: string, lendMarket: string): string {
  return borrow === lend ? `Lent in the ${lendMarket}, it` : `Turned into ${displayName(lend)}, it`;
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
  const rewardName = listJoin(tokens);
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
    borrowAmount: borrow ? usd(borrow.amountUsd) : "",
    borrowCost: borrow ? usd(borrow.baseRate * borrow.amountUsd) : "",
    lendEarn: lend ? usd((lend.baseRate + lend.builtInRate) * lend.amountUsd) : "",
    lendIt: lend && borrow ? lendIt(borrow.symbol, lend.symbol, lend.marketName) : "",
    loopDeposit: usd(deposit.amountUsd),
    loopExtraEarn: usd(depositYield * Math.max(0, deposit.amountUsd - config.principalUsd)),
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

import { displayName, getAsset } from "@/config/assets";
import { ENGINE_CONFIG } from "@/config/engine";
import { formatDate, listJoin, usd } from "@/lib/format";
import type { Leg, Strategy } from "@/lib/engine/types";
import { Chevron } from "./Chevron";
import { TYPE_LABEL } from "@/lib/strategyTypes";
import { EarningsBreakdown } from "./EarningsBreakdown";
import { StrategyFlow } from "./StrategyFlow";
import { RiskBadge } from "./RiskBadge";


/** Yearly rewards on `amount` in this leg, e.g. "about $18 in DUST rewards". */
function rewardsOn(leg: Leg, amount: number): string {
  const tokens = leg.incentives.filter((i) => i.apr > 0.00005);
  if (!tokens.length) return "";
  const total = tokens.reduce((sum, i) => sum + i.apr * (ENGINE_CONFIG.rewardValuation[i.token] ?? 1), 0) * amount;
  return `about ${usd(total)} in ${listJoin(tokens.map((i) => i.token))} rewards`;
}

/** "That earns about $580 a year, plus about $90 in DUST rewards." for `amount` in this leg. */
function earnsSentence(leg: Leg, amount: number): string {
  const earn = (leg.baseRate + leg.builtInRate) * amount;
  const rewards = rewardsOn(leg, amount);
  const main = earn >= 0.5 ? `That earns about ${usd(earn)} a year` : "";
  if (main && rewards) return `${main}, plus ${rewards}.`;
  if (main) return `${main}.`;
  return rewards ? `That earns ${rewards} a year.` : "";
}

function swapWhere(symbol: string): string {
  const conv = getAsset(symbol)?.conversion;
  return conv === "inApp" ? " in the Neverland app" : conv === "swap" ? " on a DEX" : "";
}

function getStep(symbol: string): string | null {
  const asset = getAsset(symbol);
  if (!asset?.conversion) return null;
  const name = displayName(symbol);
  const from = asset.family === "MON" ? "MON" : "AUSD";
  if (asset.conversion === "stake" && asset.stakeWith)
    return `If you don't have ${name} yet, stake MON with ${asset.stakeWith} to get it, or swap MON for it on a DEX (a token-swap app).`;
  const where = asset.conversion === "inApp" ? "in the Neverland app" : "on a DEX (a token-swap app)";
  return `If you don't have ${name} yet, swap ${from} for it ${where}.`;
}

/** Rounds of borrow-and-redeposit needed to get ~90% of the way to the target loop size. */
function loopRounds(b: number): number {
  return Math.max(2, Math.min(6, Math.ceil(Math.log(0.1) / Math.log(b))));
}

/** A walkthrough in full sentences, using the amount the user typed. */
function steps(s: Strategy, principal: number): string[] {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  const d = displayName(deposit.symbol);
  const lines: string[] = [];
  const get = getStep(deposit.symbol);
  if (get) lines.push(get);
  lines.push(`Deposit your ${usd(principal)} of ${d} in the ${deposit.marketName}. ${earnsSentence(deposit, principal)}`);
  if (!borrow) {
    const maturity = getAsset(deposit.symbol)?.builtInYield?.kind === "pt";
    lines.push(
      maturity
        ? `That's it. ${d} reaches its full value on its maturity date. You can withdraw and sell it earlier, but you may get less than you paid.`
        : "That's it. You can withdraw whenever you like, as long as the market has cash available.",
    );
    return lines;
  }
  const b = displayName(borrow.symbol);
  const borrowRewards = rewardsOn(borrow, borrow.amountUsd);
  const costLine = `In total the loan costs about ${usd(borrow.baseRate * borrow.amountUsd)} a year in interest${
    borrowRewards ? `, and Neverland pays you ${borrowRewards} for borrowing` : ""
  }.`;
  if (s.type === "yieldLoop") {
    const fraction = borrow.amountUsd / deposit.amountUsd;
    const first = principal * fraction;
    const n = lines.length + 1;
    lines.push(`Borrow about ${usd(first)} of ${b} against your deposit.`);
    const asset = getAsset(deposit.symbol);
    lines.push(
      asset?.conversion === "stake" && asset.stakeWith
        ? `Stake the borrowed ${b} with ${asset.stakeWith} (or swap it on a DEX) to get more ${d}, and deposit it too.`
        : `Swap the borrowed ${b} for more ${d}${swapWhere(deposit.symbol)} and deposit it too.`,
    );
    lines.push(
      `Repeat steps ${n} and ${n + 1} about ${loopRounds(fraction)} more times, borrowing a bit less each round, until you've borrowed about ${usd(
        borrow.amountUsd,
      )} in total and have about ${usd(deposit.amountUsd)} of ${d} deposited. ${costLine}`,
    );
  } else if (lend) {
    lines.push(`Borrow about ${usd(borrow.amountUsd)} of ${b} against your deposit. ${costLine}`);
    const l = displayName(lend.symbol);
    const move =
      lend.symbol === borrow.symbol
        ? `Lend the ${b} in the ${lend.marketName}.`
        : `Swap the ${b} for ${l}${swapWhere(lend.symbol)} and deposit it in the ${lend.marketName}.`;
    lines.push(`${move} ${earnsSentence(lend, lend.amountUsd)}`);
  }
  lines.push(
    "Check your Health Factor in the Neverland app now and then. If it gets close to 1, repay some of the loan.",
  );
  return lines;
}

/** How to unwind a borrowing strategy. */
function exitSteps(s: Strategy): string[] {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  if (!borrow) return [];
  const b = displayName(borrow.symbol);
  const d = displayName(deposit.symbol);
  const first =
    s.type === "yieldLoop"
      ? `Withdraw some ${d}, swap it back to ${b}, and repay part of the loan. Repeat until the loan is paid off.`
      : `Withdraw your ${lend ? displayName(lend.symbol) : b}${
          lend && lend.symbol !== borrow.symbol ? `, swap it back to ${b},` : ""
        } and repay the ${b} loan.`;
  const pt = s.legs.find((l) => l.role !== "borrow" && getAsset(l.symbol)?.builtInYield?.kind === "pt");
  const lines = [first, `Withdraw your ${d}.`, "Claim any DUST rewards you've collected in the Neverland app."];
  if (pt) {
    lines.push(
      `If you leave before ${displayName(pt.symbol)} matures${
        s.vars.maturity ? ` on ${formatDate(s.vars.maturity)}` : ""
      }, swapping it back may return less than you paid, which can eat into your earnings.`,
    );
  }
  return lines;
}

/** How the position's dollar value moves with market prices (separate from liquidation risk). */
function priceLine(s: Strategy): string {
  const simple = s.type === "simpleDeposit" && getAsset(s.legs[0].symbol)?.builtInYield?.kind !== "pt";
  return simple
    ? "Your money stays in a stablecoin, so its dollar value holds steady unless the stablecoin loses its $1 price."
    : "Your money stays in stablecoins, so it holds about steady unless one of them loses its $1 price.";
}

export function StrategyCard({
  s,
  rank,
  principalUsd,
  highlight = false,
}: {
  s: Strategy;
  rank: number;
  principalUsd: number;
  highlight?: boolean;
}) {
  const stable = getAsset(s.legs.find((l) => l.role === "deposit")!.symbol)?.family === "USD";
  return (
    <article
      id={`card-${s.id}`}
      className={`panel flex min-w-0 scroll-mt-6 flex-col gap-4 p-5 transition-shadow duration-500 sm:p-6 ${
        highlight ? "ring-2 ring-violet-strong" : ""
      }`}
    >
      <header>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold tabular-nums text-ink-muted">#{rank}</span>
          <RiskBadge level={s.risk} reasons={s.riskReasons} />
        </div>
        <div className="label mt-3">{TYPE_LABEL[s.type]}</div>
        <h2 className="mt-1 text-lg font-semibold tracking-[0.02em]">{s.text.name}</h2>
      </header>

      <StrategyFlow s={s} />
      <p className="text-[15px] leading-relaxed text-ink-secondary">{s.text.action}</p>
      <EarningsBreakdown s={s} principalUsd={principalUsd} />

      <details className="group rounded-panel bg-black/10 px-4 text-sm open:pb-4">
        <summary className="-mx-4 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-ink-muted transition-colors hover:text-ink">
          <span>Details: why it works, risks and steps</span>
          <Chevron />
        </summary>

        <div className="space-y-4 pt-2 leading-relaxed text-ink-secondary">
          <section>
            <h3 className="text-base font-semibold text-ink">Why it works</h3>
            <p className="mt-1">{s.text.whyNow}</p>
          </section>
          <section>
            <h3 className="text-base font-semibold text-ink">Main risk</h3>
            <p className="mt-1">{s.text.mainRisk}</p>
            <p className="mt-2 text-xs text-ink-muted">
              <span className="font-semibold">Why {s.risk.toLowerCase()} risk:</span> {s.riskReasons.join(". ")}.
            </p>
            {stable && (
              <p className="mt-1 text-xs text-ink-muted">
                <span className="font-semibold">Dollar value:</span> {priceLine(s)}
              </p>
            )}
          </section>
          <section>
            <h3 className="text-base font-semibold text-ink">Step by step</h3>
            <ol className="mt-2 space-y-2">
              {steps(s, principalUsd).map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink-muted tabular-nums">{i + 1}.</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </section>
          {exitSteps(s).length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-ink">How to get out</h3>
              <ol className="mt-2 space-y-2">
                {exitSteps(s).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-ink-muted tabular-nums">{i + 1}.</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {s.legs.some((l) => l.role === "borrow") && (
            <p className="text-xs text-ink-muted">
              These estimates assume you borrow half of the most you&apos;re allowed to.
            </p>
          )}
          <a
            href="https://app.neverland.money"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost h-9 text-[13px]"
          >
            Open Neverland ↗
          </a>
        </div>
      </details>
    </article>
  );
}

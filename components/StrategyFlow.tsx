import type { ReactNode } from "react";
import { displayName } from "@/config/assets";
import { ENGINE_CONFIG } from "@/config/engine";
import { tokenAmount, usd } from "@/lib/format";
import { heldTokens } from "@/lib/engine/math";
import type { Leg, Strategy } from "@/lib/engine/types";
import { TokenIcon } from "./TokenIcon";

const VERB: Record<Leg["role"], string> = { deposit: "Deposit", borrow: "Borrow", lend: "Lend" };

/** "main pool" → "Main pool"; "PT-AUSD isolated market" → "PT-AUSD market". */
function marketLabel(name: string): string {
  return name === "main pool" ? "Main pool" : name.replace(" isolated", "");
}

/**
 * Yearly rewards per token for this leg, hiding tiny ones: "+$30" for tokens counted in dollars,
 * then "+430" for held tokens like DUST, which are shown in tokens only.
 */
function rewardLines(leg: Leg, heldPriceUsd: Record<string, number>): { token: string; text: string }[] {
  const { heldRewards, rewardValuation } = ENGINE_CONFIG;
  const spent = leg.incentives
    .filter((i) => !heldRewards.includes(i.token))
    .map((i) => ({ token: i.token, usd: i.apr * (rewardValuation[i.token] ?? 1) * leg.amountUsd }))
    .filter((r) => r.usd >= 0.5)
    .sort((a, b) => b.usd - a.usd)
    .map((r) => ({ token: r.token, text: `+${usd(r.usd)}` }));
  const held = leg.incentives
    .filter((i) => heldRewards.includes(i.token))
    .map((i) => ({ token: i.token, n: heldTokens(i.apr * leg.amountUsd, heldPriceUsd[i.token]) }))
    .filter((r) => r.n >= 0.5)
    .map((r) => ({ token: r.token, text: `+${tokenAmount(r.n)}` }));
  return [...spent, ...held];
}

/** The vertical line joining one step's icon to the next. */
function Rail() {
  return <span aria-hidden className="mx-auto w-px flex-1 bg-white/15" />;
}

function Step({
  leg,
  heldPriceUsd,
  last,
  badge,
}: {
  leg: Leg;
  heldPriceUsd: Record<string, number>;
  last: boolean;
  badge?: ReactNode;
}) {
  const paying = leg.role === "borrow";
  const rate = paying ? leg.baseRate : leg.baseRate + leg.builtInRate;
  const rewards = rewardLines(leg, heldPriceUsd);
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col items-center gap-1">
        <TokenIcon symbol={leg.symbol} size={28} />
        {!last && <Rail />}
      </div>
      <div className={`min-w-0 ${last ? "" : "pb-1"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-7">
          <span>
            <span className="text-ink-muted">{VERB[leg.role]}</span>{" "}
            <span className="font-semibold">{displayName(leg.symbol)}</span>
          </span>
          <span className="text-xs text-ink-muted">· {marketLabel(leg.marketName)}</span>
          {badge}
        </div>
        <div className={`text-sm font-semibold tabular-nums ${paying ? "text-high" : "text-low"}`}>
          {paying ? "Costs" : "Earns"} {usd(rate * leg.amountUsd)}/yr
        </div>
        {rewards.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {rewards.map(({ token, text }) => (
              <span
                key={token}
                className="inline-flex items-center gap-1 rounded-full bg-reward/10 py-0.5 pl-1 pr-2 text-xs tabular-nums text-reward"
              >
                <TokenIcon symbol={token} size={13} />
                {text}/yr {token}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** A short caption on the rail saying how one step leads to the next. */
function Link({ text }: { text: string }) {
  return (
    <li aria-hidden className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
      <div className="flex flex-col">
        <Rail />
      </div>
      <div className="py-1.5 text-[11px] italic text-ink-muted">{text}</div>
    </li>
  );
}

/** Closing step of a loop: swap what you borrowed back into the deposit and go round again. */
function LoopBack({ symbol, times }: { symbol: string; times: string }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3">
      <span className="flex size-7 items-center justify-center rounded-full bg-violet/20 text-lavender ring-1 ring-violet/40">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
        </svg>
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <span>
          Swap to <span className="font-semibold text-ink">{displayName(symbol)}</span> and deposit again
        </span>
        <span className="rounded-full bg-violet/15 px-2.5 py-1 text-xs font-semibold text-lavender ring-1 ring-violet/30">
          ×{times} loop
        </span>
      </div>
    </li>
  );
}

/** A step rail: what goes where, how each step leads to the next, and what each earns or costs per year. */
export function StrategyFlow({ s }: { s: Strategy }) {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  const loop = s.type === "yieldLoop" && borrow;
  const held = s.heldPriceUsd;
  return (
    <ol
      aria-label="How the money moves"
      className="rounded-2xl bg-white/[0.03] px-3.5 py-3 ring-1 ring-white/10 sm:px-4"
    >
      <Step
        leg={deposit}
        heldPriceUsd={held}
        last={!borrow}
        badge={
          !borrow && (
            <span className="rounded-full bg-low/10 px-2 py-0.5 text-xs leading-normal font-semibold text-low ring-1 ring-low/25">
              No borrowing
            </span>
          )
        }
      />
      {borrow && <Link text="used as collateral to" />}
      {borrow && <Step leg={borrow} heldPriceUsd={held} last={!lend && !loop} />}
      {lend && <Link text={lend.symbol === borrow?.symbol ? "move it to" : "swap and"} />}
      {lend && <Step leg={lend} heldPriceUsd={held} last />}
      {loop && <Link text="then" />}
      {loop && (
        <LoopBack
          symbol={deposit.symbol}
          times={(deposit.amountUsd / (deposit.amountUsd - borrow.amountUsd)).toFixed(1)}
        />
      )}
    </ol>
  );
}

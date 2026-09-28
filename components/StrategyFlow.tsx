import { displayName } from "@/config/assets";
import { ENGINE_CONFIG } from "@/config/engine";
import { usd } from "@/lib/format";
import type { Leg, Strategy } from "@/lib/engine/types";
import { TokenIcon } from "./TokenIcon";

const ROLE: Record<Leg["role"], string> = { deposit: "Deposit", borrow: "Borrow", lend: "Lend" };

function shortMarket(name: string): string {
  return name === "main pool" ? "main pool" : name.replace(" isolated market", " mkt");
}

/** Yearly reward rate per token for this leg, largest first, hiding tiny ones. */
function rewardRates(leg: Leg): { token: string; rate: number }[] {
  return leg.incentives
    .map((i) => ({ token: i.token, rate: i.apr * (ENGINE_CONFIG.rewardValuation[i.token] ?? 1) }))
    .filter((r) => r.rate > 0.0005)
    .sort((a, b) => b.rate - a.rate);
}

function Pill({ leg }: { leg: Leg }) {
  const paying = leg.role === "borrow";
  const rate = paying ? leg.baseRate : leg.baseRate + leg.builtInRate;
  return (
    <div className="min-w-0 rounded-2xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        {ROLE[leg.role]} · {shortMarket(leg.marketName)}
      </div>
      <div className="mt-1 flex items-center gap-1.5 font-semibold">
        <TokenIcon symbol={leg.symbol} size={18} />
        {displayName(leg.symbol)}
      </div>
      <div className="text-sm tabular-nums">
        <span className={`font-semibold ${paying ? "text-high" : "text-low"}`}>
          {paying ? "Costs" : "Earns"} {usd(rate * leg.amountUsd)}/yr
        </span>
      </div>
      {rewardRates(leg).map(({ token, rate }) => (
        <div key={token} className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-reward">
          <TokenIcon symbol={token} size={13} />+{usd(rate * leg.amountUsd)}/yr {token}
        </div>
      ))}
    </div>
  );
}

function Arrow({ loop }: { loop?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0 text-ink-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {loop ? <path d="M4 9h13l-3-3M20 15H7l3 3" /> : <path d="M5 12h14m-5-5 5 5-5 5" />}
    </svg>
  );
}

/** Token pills with arrows: what goes where, and what each leg earns or costs per year. */
export function StrategyFlow({ s }: { s: Strategy }) {
  const deposit = s.legs.find((l) => l.role === "deposit")!;
  const borrow = s.legs.find((l) => l.role === "borrow");
  const lend = s.legs.find((l) => l.role === "lend");
  const loop = s.type === "yieldLoop";
  return (
    <div aria-label="How the money moves" className="flex flex-wrap items-center gap-2">
      <Pill leg={deposit} />
      {borrow && <Arrow loop={loop} />}
      {borrow && <Pill leg={borrow} />}
      {lend && <Arrow />}
      {lend && <Pill leg={lend} />}
      {loop && (
        <span className="rounded-full bg-violet/15 px-2.5 py-1 text-xs font-semibold text-lavender ring-1 ring-violet/30">
          ×{(deposit.amountUsd / (deposit.amountUsd - borrow!.amountUsd)).toFixed(1)} loop
        </span>
      )}
      {!borrow && (
        <span className="rounded-full bg-low/10 px-2.5 py-1 text-xs font-semibold text-low ring-1 ring-low/25">
          No borrowing
        </span>
      )}
    </div>
  );
}

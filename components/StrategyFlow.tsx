import { displayName } from "@/config/assets";
import { ENGINE_CONFIG } from "@/config/engine";
import { tokenAmount, usd } from "@/lib/format";
import { heldTokens } from "@/lib/engine/math";
import type { Leg, Strategy } from "@/lib/engine/types";
import { TokenIcon } from "./TokenIcon";

const ROLE: Record<Leg["role"], string> = { deposit: "Deposit", borrow: "Borrow", lend: "Lend" };

function shortMarket(name: string): string {
  return name === "main pool" ? "main pool" : name.replace(" isolated market", " mkt");
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

function Pill({ leg, heldPriceUsd }: { leg: Leg; heldPriceUsd: Record<string, number> }) {
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
      {rewardLines(leg, heldPriceUsd).map(({ token, text }) => (
        <div key={token} className="mt-0.5 flex items-center gap-1 text-xs tabular-nums text-reward">
          <TokenIcon symbol={token} size={13} />
          {text}/yr {token}
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
      <Pill leg={deposit} heldPriceUsd={s.heldPriceUsd} />
      {borrow && <Arrow loop={loop} />}
      {borrow && <Pill leg={borrow} heldPriceUsd={s.heldPriceUsd} />}
      {lend && <Arrow />}
      {lend && <Pill leg={lend} heldPriceUsd={s.heldPriceUsd} />}
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

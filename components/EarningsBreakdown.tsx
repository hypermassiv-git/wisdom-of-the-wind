import { displayName } from "@/config/assets";
import { formatDate, listJoin, usd } from "@/lib/format";
import { daysToMaturity } from "@/lib/sortFilter";
import type { Strategy } from "@/lib/engine/types";

/** Yearly earnings on the chosen amount, as a simple sum: earned − paid + rewards = total. */
export function EarningsBreakdown({ s, principalUsd }: { s: Strategy; principalUsd: number }) {
  const earned = s.legs
    .filter((l) => l.role !== "borrow")
    .reduce((sum, l) => sum + l.amountUsd * (l.baseRate + l.builtInRate), 0);
  const paid = s.legs.filter((l) => l.role === "borrow").reduce((sum, l) => sum + l.amountUsd * l.baseRate, 0);
  const tokens = Object.entries(s.earnings.rewardsByToken)
    .filter(([, v]) => v > 0.005)
    .map(([t]) => t);
  const rewardLabel = `${listJoin(tokens.length ? tokens : ["DUST"])} rewards`;

  const positive = earned + s.earnings.rewards;
  const earnedShare = positive > 0 ? (earned / positive) * 100 : 0;

  return (
    <div className="rounded-chip bg-white/[0.02] p-4 ring-1 ring-white/5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="label">You could earn</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {usd(s.earnings.net)}
            <span className="ml-1.5 text-sm font-medium text-ink-muted">a year on {usd(principalUsd)}</span>
          </div>
        </div>
        <div className="text-right text-sm font-semibold tabular-nums text-ink-secondary">
          {((s.earnings.net / principalUsd) * 100).toFixed(1)}%
          <div className="text-xs font-normal text-ink-muted">a year</div>
        </div>
      </div>

      {(() => {
        const days = daysToMaturity(s);
        const pt = s.legs.find((l) => l.role !== "borrow" && l.symbol.startsWith("PT-"));
        if (days === null || days > 30 || !pt || !s.vars.maturity) return null;
        return (
          <p className="mt-2 text-xs leading-relaxed text-medium">
            {displayName(pt.symbol)}&apos;s fixed rate ends {formatDate(s.vars.maturity)}. This yearly figure assumes you
            then move into the next {displayName(pt.symbol)} at a similar rate. If you do nothing, it becomes plain{" "}
            {displayName(pt.symbol).replace("PT-", "")} and stops earning the fixed rate.
          </p>
        );
      })()}

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className="bg-ink/85" style={{ width: `${earnedShare}%` }} />
        <div className="bg-reward" style={{ width: `${100 - earnedShare}%` }} />
      </div>

      <dl className="mt-3 space-y-1 text-sm tabular-nums">
        <Row dot="bg-ink/85" label="Interest you earn" value={usd(earned)} />
        {paid > 0.5 && <Row label="Interest you pay on the loan" value={`−${usd(paid)}`} muted />}
        <Row dot="bg-reward" label={rewardLabel} value={usd(s.earnings.rewards)} reward />
        <div className="flex justify-between border-t border-white/10 pt-1 font-semibold">
          <dt>Total</dt>
          <dd>{usd(s.earnings.net)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Row({
  dot,
  label,
  value,
  muted,
  reward,
}: {
  dot?: string;
  label: string;
  value: string;
  muted?: boolean;
  reward?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-ink-muted">
        <span className={`size-2 rounded-full ${dot ?? "bg-transparent"}`} aria-hidden />
        {label}
      </dt>
      <dd className={reward ? "font-semibold text-reward" : muted ? "text-ink-muted" : "font-semibold"}>{value}</dd>
    </div>
  );
}

import { baseName, displayName, getAsset } from "@/config/assets";
import { formatDate, tokenAmount, usd } from "@/lib/format";
import { heldTokens } from "@/lib/engine/math";
import { daysToMaturity } from "@/lib/sortFilter";
import type { Leg, Strategy } from "@/lib/engine/types";
import { TokenIcon } from "./TokenIcon";

/** Bar and dot colour per reward token, matching its icon. Other tokens use the generic reward colour. */
const REWARD_COLOR: Record<string, string> = { DUST: "bg-dust", MON: "bg-mon" };
const rewardColor = (token: string) => REWARD_COLOR[token] ?? "bg-reward";

/** Yearly USD per token, in order of first appearance. Tokens shown under one name (WMON and MON) are merged. */
function byToken(parts: [string, number][]): [string, number][] {
  const totals = new Map<string, [string, number]>();
  for (const [token, v] of parts) {
    const key = baseName(token);
    const prev = totals.get(key);
    // Show the token under its display name so the icon matches the label (WMON → MON).
    totals.set(key, [getAsset(key) ? key : token, (prev?.[1] ?? 0) + v]);
  }
  return [...totals.values()];
}

/** Market interest is paid in the leg's own token; built-in yield in the token it builds up in (MON for LSTs). */
function earnedParts(l: Leg): [string, number][] {
  const builtIn = getAsset(l.symbol)?.builtInYield?.paidIn ?? l.symbol;
  return [
    [l.symbol, l.amountUsd * l.baseRate],
    [builtIn, l.amountUsd * l.builtInRate],
  ];
}

/** Yearly earnings on the chosen amount, as a simple sum: earned + rewards − paid = total. */
export function EarningsBreakdown({ s, principalUsd }: { s: Strategy; principalUsd: number }) {
  const earnedAll = byToken(s.legs.filter((l) => l.role !== "borrow").flatMap(earnedParts));
  const earned = earnedAll.reduce((sum, [, v]) => sum + v, 0);
  // Hide sub-$1 rows (e.g. a sliver of lending interest), but always show at least one.
  const earnedByToken = earnedAll.filter(([, v]) => Math.abs(v) >= 0.5);
  if (!earnedByToken.length) earnedByToken.push([earnedAll[0][0], earned]);
  const paidByToken = byToken(
    s.legs.filter((l) => l.role === "borrow").map((l) => [l.symbol, l.amountUsd * l.baseRate]),
  ).filter(([, v]) => v > 0.5);
  // One row per reward token: MON first, then other tokens.
  const rewards = Object.entries(s.earnings.rewardsByToken)
    .filter(([, v]) => v > 0.005)
    .sort(([a], [b]) => (a === "MON" ? -1 : b === "MON" ? 1 : 0));
  // DUST you build up, in tokens below the total: it's your piece of Neverland, not spending money.
  const held = Object.entries(s.earnings.heldByToken)
    .map(([token, v]) => [token, heldTokens(v, s.heldPriceUsd[token])] as const)
    .filter(([, n]) => n >= 0.5);

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
            then move into the next {baseName(pt.symbol)} at a similar rate. If you do nothing, it becomes plain{" "}
            {baseName(pt.symbol).replace("PT-", "")} and stops earning the fixed rate.
          </p>
        );
      })()}

      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className="bg-ink/85" style={{ width: `${earnedShare}%` }} />
        {rewards.map(([token, value]) => (
          <div
            key={token}
            className={rewardColor(token)}
            style={{ width: `${positive > 0 ? (value / positive) * 100 : 0}%` }}
          />
        ))}
      </div>

      <dl className="mt-3 space-y-1 text-sm tabular-nums">
        {earnedByToken.map(([token, value]) => (
          <Row key={token} dot="bg-ink/85" label="Interest you earn" value={usd(value)} token={token} />
        ))}
        {rewards.map(([token, value]) => (
          <Row key={token} dot={rewardColor(token)} label="Rewards" value={usd(value)} token={token} reward />
        ))}
        {paidByToken.map(([token, value]) => (
          <Row key={token} label="Interest you pay on the loan" value={`−${usd(value)}`} token={token} muted />
        ))}
        <div className="flex justify-between border-t border-white/10 pt-1 font-semibold">
          <dt>Total</dt>
          <dd>{usd(s.earnings.net)}</dd>
        </div>
        {held.map(([token, n], i) => (
          <div key={token} className={i === 0 ? "border-t border-white/10 pt-1" : ""}>
            <Row dot={rewardColor(token)} label="Your piece of Neverland" value={`+${tokenAmount(n)}`} token={token} reward />
          </div>
        ))}
      </dl>
    </div>
  );
}

function Row({
  dot,
  label,
  value,
  token,
  muted,
  reward,
}: {
  dot?: string;
  label: string;
  value: string;
  /** Token the amount is paid in, shown after the dollar value: "$40 ◉ MON". */
  token: string;
  muted?: boolean;
  reward?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-ink-muted">
        <span className={`size-2 rounded-full ${dot ?? "bg-transparent"}`} aria-hidden />
        {label}
      </dt>
      <dd
        className={`flex items-center gap-1 ${reward ? "font-semibold text-reward" : muted ? "text-ink-muted" : "font-semibold"}`}
      >
        {value}
        <span className="ml-0.5 flex items-center gap-1 text-xs font-normal text-ink-muted">
          <TokenIcon symbol={token} size={14} />
          {baseName(token)}
        </span>
      </dd>
    </div>
  );
}

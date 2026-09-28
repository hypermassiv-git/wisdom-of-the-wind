import type { RiskLevel } from "@/lib/engine/types";
import { Chevron } from "./Chevron";
import { RiskBadge } from "./RiskBadge";

const TERMS: [string, string][] = [
  ["Deposit", "Putting your coins into Neverland so they earn. You can take them back out later."],
  ["Borrow", "Taking a loan against your deposit. You pay interest on it, and you must keep enough deposited to cover it."],
  [
    "Health Factor",
    "Neverland's measure of how covered your loan is. Above 1 is safe; the higher, the more room you have. If it falls below 1, part of your deposit is sold to repay the loan.",
  ],
  ["Liquidation", "What happens below a Health Factor of 1: some of your deposit is sold to repay the loan, with a small penalty."],
  ["Loop", "Deposit, borrow, turn the loan into more of your deposit, and repeat. It makes your position bigger than the money you started with."],
  [
    "DUST",
    "Neverland's reward token. Neverland pays it to depositors and borrowers on top of interest. Earnings here count DUST at today's market price{dustPrice}.",
  ],
  ["MON", "The main coin of the Monad network."],
  ["shMON, sMON, gMON", "MON that's been staked with FastLane (shMON), Kintsu (sMON) or Magma (gMON). They earn MON staking rewards and track MON's price. You can get them by staking MON with the issuer or swapping on a DEX."],
  ["AUSD, USDC, USDT0", "Stablecoins: tokens designed to stay worth $1 each."],
  ["earnAUSD", "AUSD placed in a vault that earns interest on its own."],
  ["syzUSD", "Staked Yuzu USD: a stablecoin that earns Yuzu's staking yield on its own."],
  [
    "PT-AUSD, PT-shMON",
    "Pendle principal tokens. You buy them below face value and they're worth the full amount on their maturity date, which gives a fixed yearly rate.",
  ],
  ["Main pool vs isolated market", "The main pool holds most assets. Isolated markets are smaller, separate pools for one pair of assets."],
  ["DEX", "An app for swapping one coin for another. Network fees on Monad are usually tiny."],
];

const RISK_LEVELS: [RiskLevel, string][] = [
  [
    "Low",
    "Nothing is borrowed, or your deposit and loan track the same asset (e.g. shMON against MON), with at most one small extra factor.",
  ],
  [
    "Medium",
    "Borrowing against a different kind of asset, or two small factors together. Small factors are repeated borrowing, earnings that rely on current reward rates, and lending into a smaller market.",
  ],
  ["High", "Borrowing against a different kind of asset plus other factors, where a price drop could trigger liquidation."],
];

export function Glossary({ dustPriceUsd }: { dustPriceUsd?: number }) {
  const dustPrice = dustPriceUsd ? ` ($${dustPriceUsd.toFixed(4)})` : "";
  return (
    <details className="group panel mt-5 px-5 py-4 text-sm sm:px-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
        New here? What these words mean, and how risk is rated
        <Chevron />
      </summary>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {TERMS.map(([term, raw]) => {
          const def = raw.replace("{dustPrice}", dustPrice);
          return (
          <div key={term}>
            <dt className="font-semibold">{term}</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-secondary">{def}</dd>
          </div>
          );
        })}
      </dl>
      <div className="label mt-5">Risk levels</div>
      <dl className="mt-3 space-y-2.5">
        {RISK_LEVELS.map(([level, def]) => (
          <div key={level} className="flex items-start gap-3">
            <dt className="w-[6.5rem] shrink-0">
              <RiskBadge level={level} />
            </dt>
            <dd className="leading-relaxed text-ink-secondary">{def}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Risk levels are about losing money through liquidation or funds being tied up. Separately, anything held in MON,
        bitcoin, ether or gold goes up and down with that asset&apos;s price.
      </p>
    </details>
  );
}

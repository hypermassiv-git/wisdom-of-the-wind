import type { ReactNode } from "react";
import type { RiskLevel } from "@/lib/engine/types";
import { Chevron } from "./Chevron";
import { RiskBadge } from "./RiskBadge";
import { TokenIcon } from "./TokenIcon";

/** Words, grouped by topic. Keep each meaning to one short line. */
const GROUPS: { title: string; terms: [string, string][] }[] = [
  {
    title: "The basics",
    terms: [
      ["Deposit", "Put coins into Neverland so they earn interest."],
      ["Borrow", "Take a loan against your deposit. You pay interest on it."],
      ["Loop", "Borrow, turn the loan into more of your deposit, and repeat."],
    ],
  },
  {
    title: "Keeping a loan safe",
    terms: [
      ["Borrow limit (LTV)", "The most you can borrow, as a share of your deposit. Strategies here stay well under it."],
      ["E-Mode", "A Neverland setting that raises the limit for coins that move together, like shMON and MON."],
      ["Health Factor", "How covered your loan is. Above 1 is safe; higher is safer."],
      ["Liquidation", "Below 1, part of your deposit is sold to repay the loan, plus a penalty."],
    ],
  },
  {
    title: "Rewards",
    terms: [
      ["DUST", "Your piece of Neverland. Lock it as veDUST for a weekly cut of revenue in USDC, and a vote."],
      ["MON rewards", "Extra MON on some deposits and loans. Claim it at merkl.xyz."],
    ],
  },
  {
    title: "Places",
    terms: [
      ["Main pool", "Neverland's big shared market for most coins."],
      ["Isolated market", "A smaller, separate market for one pair of coins."],
      ["DEX", "An app for swapping one coin for another."],
    ],
  },
];

const COINS: { symbols: string[]; name: string; meaning: string }[] = [
  { symbols: ["MON"], name: "MON", meaning: "Monad's main coin" },
  { symbols: ["shMON", "sMON", "gMON"], name: "shMON, sMON, gMON", meaning: "Staked MON that earns staking yield" },
  { symbols: ["AUSD", "USDC", "USDT0"], name: "AUSD, USDC, USDT0", meaning: "Stablecoins, worth $1 each" },
  { symbols: ["earnAUSD"], name: "earnAUSD", meaning: "AUSD in a vault that earns on its own" },
  { symbols: ["syzUSD"], name: "syzUSD", meaning: "Yuzu's stablecoin that earns on its own" },
  { symbols: ["PT-AUSD", "PT-shMON"], name: "PT-AUSD, PT-shMON", meaning: "Fixed-rate tokens, full value at maturity" },
];

const RISK_LEVELS: [RiskLevel, string][] = [
  ["Low", "No loan, or the deposit and loan move together (like shMON and MON)."],
  ["Medium", "A loan against a different kind of coin, or two small extra risks."],
  ["High", "A loan against a different kind of coin plus more risks. A price drop could trigger liquidation."],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

export function Glossary() {
  return (
    <details className="group panel mt-5 px-5 py-4 text-sm sm:px-6">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold">
        New here? What these words mean, and how risk is rated
        <Chevron />
      </summary>
      <div className="mt-3 space-y-5">
        {GROUPS.map((g) => (
          <Section key={g.title} title={g.title}>
            <dl className="mt-1 divide-y divide-white/5">
              {g.terms.map(([term, def]) => (
                <div key={term} className="grid gap-x-6 gap-y-0.5 py-2.5 sm:grid-cols-[10rem_1fr]">
                  <dt className="font-semibold">{term}</dt>
                  <dd className="text-ink-secondary">{def}</dd>
                </div>
              ))}
            </dl>
          </Section>
        ))}

        <Section title="Coins">
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {COINS.map((c) => (
              <li key={c.name} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/10">
                <span className="flex shrink-0 -space-x-1.5">
                  {c.symbols.map((sym) => (
                    <TokenIcon key={sym} symbol={sym} size={22} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{c.name}</span>
                  <span className="block text-xs text-ink-secondary">{c.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Risk levels">
          <dl className="mt-1 divide-y divide-white/5">
            {RISK_LEVELS.map(([level, def]) => (
              <div key={level} className="grid items-center gap-x-6 gap-y-1.5 py-2.5 sm:grid-cols-[10rem_1fr]">
                <dt>
                  <RiskBadge level={level} />
                </dt>
                <dd className="text-ink-secondary">{def}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-muted">
            Small extra risks: looping, relying on reward rates, or lending into a smaller market. Separately, MON,
            bitcoin, ether and gold go up and down with their own price.
          </p>
        </Section>
      </div>
    </details>
  );
}

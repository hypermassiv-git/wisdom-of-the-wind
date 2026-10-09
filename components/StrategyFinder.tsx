"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { ENGINE_CONFIG } from "@/config/engine";
import type { StrategiesResponse } from "@/lib/api";
import { runEngine, runEngineDetailed } from "@/lib/engine";
import { pct, usd } from "@/lib/format";
import {
  type AssetFilter,
  countByType,
  heldAssets,
  type SortKey,
  sortAndFilter,
  startAsset,
  type TypeFilter,
} from "@/lib/sortFilter";
import { TYPE_FILTERS } from "@/lib/strategyTypes";
import { AssetPicker } from "./AssetPicker";
import { Glossary } from "./Glossary";
import { HowItWorks } from "./HowItWorks";
import { StrategyCard } from "./StrategyCard";

type State =
  | { status: "idle" }
  | { status: "loading"; previous?: StrategiesResponse }
  | { status: "done"; data: StrategiesResponse }
  | { status: "error"; message: string };

async function fetchStrategies(): Promise<StrategiesResponse> {
  const res = await fetch("/api/strategies", { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric",
  });
}

export function StrategyFinder() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [amountText, setAmountText] = useState("1000");
  const [sort, setSort] = useState<SortKey>("yield");
  const [type, setType] = useState<TypeFilter>("all");
  const [asset, setAssetState] = useState<AssetFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Scroll to and briefly highlight a card (used by the starter pick).
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`card-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [highlightId]);
  const parsed = Number(amountText.replace(/[^0-9.]/g, ""));
  const amountValid = parsed >= 10;
  const amount = amountValid ? Math.min(parsed, 100_000_000) : 1000;

  // Quietly load today's rates on arrival, for the landing stats and an instant reveal.
  const [preview, setPreview] = useState<StrategiesResponse | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollOnShow, setScrollOnShow] = useState(false);

  // A shared link like "/?have=AUSD" opens straight to that token's strategies.
  const [autoReveal, setAutoReveal] = useState(false);
  useEffect(() => {
    const have = new URLSearchParams(window.location.search).get("have");
    if (have) {
      setAssetState(have);
      setAutoReveal(true);
    }
  }, []);

  function setAsset(v: AssetFilter) {
    setAssetState(v);
    setType("all");
    setShowAll(false);
    const url = new URL(window.location.href);
    if (v === "all") url.searchParams.delete("have");
    else url.searchParams.set("have", v);
    history.replaceState(null, "", url);
  }

  useEffect(() => {
    let cancelled = false;
    fetchStrategies()
      .then((d) => !cancelled && setPreview(d))
      .catch(() => {}); // Landing still works; the button falls back to a normal load.
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollOnShow && state.status === "done") {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollOnShow(false);
    }
  }, [scrollOnShow, state.status]);

  useEffect(() => {
    if (!autoReveal || state.status !== "idle") return;
    setAutoReveal(false);
    reveal();
  });

  function reveal() {
    setScrollOnShow(true);
    if (preview) setState({ status: "done", data: preview });
    else load();
  }

  const teaser = useMemo(
    () => (preview ? runEngine(preview.snapshot, { ...ENGINE_CONFIG, principalUsd: 1000 }) : null),
    [preview],
  );

  async function load() {
    setState((s) => ({ status: "loading", previous: s.status === "done" ? s.data : undefined }));
    try {
      const [data] = await Promise.all([fetchStrategies(), new Promise((r) => setTimeout(r, 600))]);
      setState({ status: "done", data });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  const data = state.status === "done" ? state.data : state.status === "loading" ? state.previous : undefined;
  const loading = state.status === "loading";

  // Re-run the engine in the browser for the chosen amount (same rates, scaled dollars),
  // then sort and filter.
  const { strategies: all, tooBig } = useMemo(
    () =>
      data
        ? runEngineDetailed(data.snapshot, { ...ENGINE_CONFIG, principalUsd: amount, maxResults: 50 })
        : { strategies: [], tooBig: 0 },
    [data, amount],
  );
  const assets = useMemo(() => heldAssets(all), [all]);
  // A token can drop out (e.g. the amount is too big for its markets); fall back to all tokens.
  const activeAsset = asset !== "all" && assets.some((a) => a.name === asset) ? asset : "all";
  const picked = activeAsset !== "all";
  const counts = useMemo(() => countByType(all), [all]);
  const matching = useMemo(() => sortAndFilter(all, sort, type, activeAsset), [all, sort, type, activeAsset]);
  const strategies = showAll ? matching : matching.slice(0, ENGINE_CONFIG.maxResults);
  // Safest simple pick for newcomers: the best-paying stablecoin deposit in the main pool.
  const starter = useMemo(
    () =>
      all
        .filter((s) => s.type === "simpleDeposit" && s.legs[0].marketKind === "main")
        .filter((s) => s.risk === "Low")
        .filter((s) => ["USDC", "USDT0", "AUSD"].includes(s.legs[0].symbol))
        .sort((a, b) => b.netApr - a.netApr)[0],
    [all],
  );
  // With a token picked: its plain deposit, if a riskier strategy is ranked above it.
  const simplest = useMemo(() => {
    if (!picked || matching[0]?.type === "simpleDeposit") return undefined;
    return matching
      .filter((s) => s.type === "simpleDeposit")
      .sort((a, b) => b.netApr - a.netApr)[0];
  }, [picked, matching]);

  if (state.status === "idle") {
    const top = teaser?.[0];
    return (
      <div className="flex flex-col items-center text-center">
        <div className="rise mt-10 flex flex-col items-center gap-5" style={delay(240)}>
          <div className="relative">
            <div aria-hidden className="glow-pulse absolute -inset-3 rounded-full bg-brand-from/40 blur-xl" />
            <button className="btn-primary relative sm:h-14 sm:px-9 sm:text-base" onClick={reveal}>
              Check strategies now
            </button>
          </div>
        </div>

        <div className="rise w-full" style={delay(360)}>
          <HowItWorks />
        </div>

        {top && (
          <div className="rise mt-16 w-full max-w-xl px-2" style={delay(480)}>
            <p className="label mb-5">A peek at today&apos;s top strategy</p>
            <div
              onClick={reveal}
              className="group relative cursor-pointer text-left"
              title="See all strategies"
            >
              <div
                inert
                className="max-h-[320px] -rotate-1 overflow-hidden transition-transform duration-300 group-hover:rotate-0 sm:-rotate-2"
                style={{
                  maskImage: "linear-gradient(to bottom, black 50%, transparent)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent)",
                }}
              >
                <StrategyCard s={top} rank={1} principalUsd={1000} />
              </div>
            </div>
            <button className="btn-ghost mt-2" onClick={reveal}>
              See all {teaser!.length} strategies
              <span aria-hidden>→</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="mt-10 scroll-mt-6" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted" aria-live="polite">
          {loading
            ? "Checking live rates…"
            : data
              ? `Rates checked ${formatTime(data.fetchedAt)}`
              : "Couldn't check rates"}
        </p>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <span className={loading ? "animate-spin" : ""} aria-hidden>
            ↻
          </span>
          Refresh
        </button>
      </div>

      {data?.source === "mock" && (
        <Notice>Showing sample rates. Live data isn&apos;t connected yet, so these numbers are for illustration only.</Notice>
      )}
      {data?.stale && <Notice>Live rates couldn&apos;t be loaded just now, so these may be out of date.</Notice>}
      {state.status === "error" && <Notice>{state.message}</Notice>}

      {loading && !data ? (
        <SkeletonList />
      ) : data ? (
        <div className={`mt-5 transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
          <AssetPicker assets={assets} value={activeAsset} onChange={setAsset} />
          <div className="panel mt-3 flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <label className="block">
              <span className="label">
                {picked ? `How much ${activeAsset}? (in $)` : "How much would you put in?"}
              </span>
              <span className="mt-2 flex items-center gap-1 rounded-full bg-white/[0.06] px-4 py-2 ring-1 ring-white/10 focus-within:ring-violet-strong">
                <span className="text-ink-muted">$</span>
                <input
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className="w-32 bg-transparent text-lg font-semibold tabular-nums outline-none"
                  aria-label="Amount in US dollars"
                />
              </span>
              {!amountValid ? (
                <span className="mt-1.5 block text-xs text-medium">Enter an amount of $10 or more. Showing $1,000.</span>
              ) : amount >= 100_000 ? (
                <span className="mt-1.5 block text-xs text-medium">
                  Figures include how an amount this large moves each market&apos;s rates. Swap costs aren&apos;t
                  included.
                </span>
              ) : null}
            </label>
            <div role="group" aria-label="Sort strategies" className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
              {(
                [
                  ["yield", "Best yield"],
                  ["risk", "Lowest risk"],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  aria-pressed={sort === key}
                  className={`h-9 flex-1 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    sort === key ? "bg-white/10 text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!picked && (
          <div
            role="group"
            aria-label="Filter by strategy type"
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          >
            {([["all", "All types"], ...TYPE_FILTERS] as [TypeFilter, string][])
              .filter(([key]) => key === "all" || counts[key])
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  aria-pressed={type === key}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium whitespace-nowrap transition-colors ${
                    type === key ? "bg-white/10 text-ink ring-1 ring-white/20" : "text-ink-muted ring-1 ring-white/10 hover:text-ink"
                  }`}
                >
                  {label}
                  {key !== "all" && <span className="text-[11px] tabular-nums text-ink-muted">{counts[key]}</span>}
                </button>
              ))}
          </div>
          )}

          <Glossary dustPriceUsd={data.dustPriceUsd} />

          {strategies.length === 0 ? (
            <div className="panel mt-5 p-8 text-center text-ink-secondary">
              {picked
                ? `Nothing that starts with ${activeAsset} earns more than ${pct(data.minNetApr, 0)} a year right now. `
                : `Nothing of this type earns more than ${pct(data.minNetApr, 0)} a year right now. Try another type, or check back later. `}
              Rates change often.
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-ink-muted">
                {strategies.length < matching.length
                  ? `Top ${strategies.length} of ${matching.length}`
                  : picked
                    ? `${matching.length} ${matching.length === 1 ? "way" : "ways"} to earn with ${activeAsset}`
                    : `${matching.length} strategies`}
                , {sort === "yield" ? "best yield first" : "lowest risk first"}
                {tooBig > 0 && `, ${tooBig} hidden because ${usd(amount)} is more than their markets can take`}
                {(type !== "all" || sort !== "yield" || picked) && (
                  <>
                    {" "}
                    (
                    <button
                      className="underline underline-offset-2 hover:text-ink"
                      onClick={() => {
                        setAsset("all");
                        setSort("yield");
                      }}
                    >
                      reset to all strategies
                    </button>
                    )
                  </>
                )}
                .
              </p>
              {picked && simplest && (
                <p className="mt-1 text-xs text-ink-muted">
                  Want it simple?{" "}
                  <button className="underline underline-offset-2 hover:text-ink" onClick={() => setHighlightId(simplest.id)}>
                    Just deposit {activeAsset}: about {usd(simplest.earnings.net)} a year on {usd(amount)}, no loan
                  </button>
                  .
                </p>
              )}
              {!picked && type === "all" && starter && (
                <p className="mt-1 text-xs text-ink-muted">
                  Just starting out? The simplest pick is{" "}
                  <button className="underline underline-offset-2 hover:text-ink" onClick={() => {
                      setAsset(startAsset(starter));
                      setSort("risk");
                      setHighlightId(starter.id);
                    }}
                  >
                    depositing {starter.legs[0].symbol}: about {usd(starter.earnings.net)} a year on {usd(amount)}, no
                    loan
                  </button>
                  .
                </p>
              )}
              <div className="mx-auto mt-4 grid max-w-2xl gap-4 lg:max-w-none lg:grid-cols-2">
                {strategies.map((s, i) => (
                  <StrategyCard
                    key={s.id}
                    s={s}
                    rank={i + 1}
                    principalUsd={amount}
                    highlight={s.id === highlightId}
                    fetchedAt={data.fetchedAt}
                  />
                ))}
              </div>
              {matching.length > ENGINE_CONFIG.maxResults && (
                <div className="mt-5 flex justify-center">
                  <button className="btn-ghost" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? `Show top ${ENGINE_CONFIG.maxResults} only` : `Show all ${matching.length} strategies`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="mt-4 rounded-xl bg-gradient-to-b from-yellow-400/30 to-yellow-500/35 px-4 py-3 text-sm backdrop-blur-xl"
    >
      {children}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="panel flex flex-col gap-4 p-6">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

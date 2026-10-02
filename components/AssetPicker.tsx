"use client";

import { useEffect, useRef } from "react";
import type { AssetFilter, HeldAsset } from "@/lib/sortFilter";
import { TokenIcon } from "./TokenIcon";

const chip = (on: boolean) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors ${
    on ? "bg-white/10 text-ink ring-1 ring-white/30" : "text-ink-muted ring-1 ring-white/10 hover:text-ink"
  }`;

/** "What do you have?": pick the token you hold to see only strategies that start with it. */
export function AssetPicker({
  assets,
  value,
  onChange,
}: {
  assets: HeldAsset[];
  value: AssetFilter;
  onChange: (v: AssetFilter) => void;
}) {
  // Everyday tokens first, then ones that earn on their own (staked MON, PTs, yield stablecoins).
  const shown = [...assets.filter((a) => a.plain), ...assets.filter((a) => !a.plain)];
  const row = useRef<HTMLDivElement>(null);

  // On phones the row scrolls sideways; keep the picked token in view.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && row.current) row.current.scrollLeft = el.offsetLeft - row.current.offsetLeft - 20;
  }, [value]);

  return (
    <div className="panel p-5 sm:p-6">
      <p className="label">What do you have?</p>
      <div
        ref={row}
        role="group"
        aria-label="Filter by the token you have"
        className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <button onClick={() => onChange("all")} aria-pressed={value === "all"} className={chip(value === "all")}>
          All tokens
        </button>
        {shown.map((a) => (
          <button key={a.name} onClick={() => onChange(a.name)} aria-pressed={value === a.name} className={chip(value === a.name)}>
            <TokenIcon symbol={a.symbol} size={20} />
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}

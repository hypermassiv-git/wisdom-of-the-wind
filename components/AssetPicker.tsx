"use client";

import { useEffect } from "react";
import type { AssetFilter, HeldAsset } from "@/lib/sortFilter";
import { TokenIcon } from "./TokenIcon";
import { useScrollFade } from "./useScrollFade";

const chip = (on: boolean) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
    on ? "border border-white/30 bg-white/10 text-ink" : "border border-white/10 text-ink-muted hover:text-ink"
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
  const { ref: row, props: fade } = useScrollFade<HTMLDivElement>();

  // On phones the row scrolls sideways; keep the picked token in view, clear of the edge fade.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && row.current) row.current.scrollLeft = el.offsetLeft - row.current.offsetLeft - 56;
  }, [value, row]);

  return (
    <div className="panel p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">What do you have?</h2>
      <div
        {...fade}
        role="group"
        aria-label="Filter by the token you have"
        // Vertical padding leaves room for the focus outline, which the scroll container would clip.
        className="scroll-fade -mx-5 mt-1.5 flex scroll-px-14 gap-2 overflow-x-auto px-5 py-1.5 [scrollbar-width:none] sm:mx-0 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pt-0 sm:pb-1"
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

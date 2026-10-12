"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetFilter, HeldAsset } from "@/lib/sortFilter";
import { TokenIcon } from "./TokenIcon";

const chip = (on: boolean) =>
  `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
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
  // Which ends of the row have more tokens to scroll to, so they fade and hint at scrolling.
  const [more, setMore] = useState({ left: false, right: false });
  const updateMore = useCallback(() => {
    const r = row.current;
    if (!r) return;
    const left = r.scrollLeft > 1;
    const right = r.scrollLeft + r.clientWidth < r.scrollWidth - 1;
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  }, []);

  // On phones the row scrolls sideways; keep the picked token in view.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && row.current) row.current.scrollLeft = el.offsetLeft - row.current.offsetLeft - 20;
    updateMore();
  }, [value, updateMore]);

  useEffect(() => {
    const r = row.current;
    if (!r) return;
    const ro = new ResizeObserver(updateMore);
    ro.observe(r);
    return () => ro.disconnect();
  }, [updateMore, assets]);

  return (
    <div className="panel p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">What do you have?</h2>
      <div
        ref={row}
        role="group"
        aria-label="Filter by the token you have"
        onScroll={updateMore}
        // Vertical padding keeps the chips' rings from being clipped by the scroll container.
        className="scroll-fade -mx-5 mt-2 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] sm:mx-0 sm:mt-3 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0"
        style={{ "--fade-l": more.left ? "48px" : "0px", "--fade-r": more.right ? "48px" : "0px" } as React.CSSProperties}
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

/**
 * Coloured token icons, matching the hover style in the Neverland app: a coloured symbol
 * (public/tokens/<key>.svg) on a coloured circle with a coloured ring.
 */

import { getAsset } from "@/config/assets";

interface IconStyle {
  /** Circle fill (colour or CSS gradient). */
  bg: string;
  /** Ring colour (colour or CSS gradient). */
  ring: string;
  /** Ring thickness relative to the default (0 = no ring). */
  ringWeight: number;
  /** Symbol size as a share of the circle. */
  scale: number;
  offsetX?: number;
  offsetY?: number;
}

const PT_RING = "#1be3c2";

const STYLES: Record<string, IconStyle> = {
  mon: { bg: "#6e54ff", ring: "#ffffff", ringWeight: 1, scale: 0.6 },
  wmon: { bg: "#200053", ring: "#ffffff", ringWeight: 1, scale: 0.6 },
  gmon: { bg: "#102231", ring: "#eb7c10", ringWeight: 1, scale: 0.6 },
  shmon: { bg: "#5046E5", ring: "#5046E5", ringWeight: 0, scale: 0.5 },
  hmon: { bg: "#00D2FF", ring: "#00D2FF", ringWeight: 0, scale: 0.65 },
  smon: { bg: "linear-gradient(180deg, #3D1F89 0%, #16033D 100%)", ring: "#16033D", ringWeight: 1, scale: 0.6 },
  ausd: { bg: "#9a9350", ring: "#ffffff", ringWeight: 1, scale: 0.66, offsetY: -0.037 },
  earnausd: { bg: "#00c260", ring: "#000000", ringWeight: 1, scale: 0.55 },
  syzusd: { bg: "#6BCF13", ring: "#6BCF13", ringWeight: 0, scale: 0.75, offsetX: -0.0523 },
  usdc: { bg: "#2671C4", ring: "#ffffff", ringWeight: 1, scale: 0.66 },
  usdt0: { bg: "#00805e", ring: "#ffffff", ringWeight: 1, scale: 0.6 },
  xaut0: { bg: "#807148", ring: "#ffffff", ringWeight: 1, scale: 0.6 },
  weth: { bg: "#303030", ring: "#939393", ringWeight: 1, scale: 0.7 },
  wbtc: { bg: "#000000", ring: "#39363f", ringWeight: 1.3, scale: 0.8 },
  cbbtc: { bg: "#ffffff", ring: "#0052FF", ringWeight: 2, scale: 0.83 },
  "pt-ausd": { bg: "#9a9350", ring: PT_RING, ringWeight: 2, scale: 0.66, offsetY: -0.037 },
  "pt-shmon": { bg: "#5046E5", ring: PT_RING, ringWeight: 2, scale: 0.5 },
  dust: {
    bg: "linear-gradient(180deg, #480052 0%, #192170 100%)",
    ring: "linear-gradient(180deg, #9a00b2 0%, #c757d8 100%)",
    ringWeight: 1,
    scale: 0.6,
  },
};

const FALLBACK: IconStyle = { bg: "#374151", ring: "#6B7280", ringWeight: 1, scale: 0.6 };

export function TokenIcon({ symbol, size = 18 }: { symbol: string; size?: number }) {
  const key = (getAsset(symbol)?.symbol ?? symbol).toLowerCase();
  const known = key in STYLES;
  const s = STYLES[key] ?? FALLBACK;
  const ring = s.ringWeight ? Math.max(1, Math.round((size / 24) * s.ringWeight)) : 0;
  const inner = size * s.scale;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 rounded-full"
      style={{ width: size, height: size, padding: ring, background: s.ring }}
    >
      <span
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{ background: s.bg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/tokens/${known ? key : "default"}.svg`}
          alt=""
          width={inner}
          height={inner}
          style={{
            width: inner,
            height: inner,
            transform: `translate(${(s.offsetX ?? 0) * size}px, ${(s.offsetY ?? 0) * size}px)`,
          }}
        />
      </span>
    </span>
  );
}

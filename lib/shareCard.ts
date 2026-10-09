/**
 * Draws a strategy as a 1200×675 PNG for sharing on X (16:9 shows uncropped in the timeline).
 * Browser only. Colours follow app/globals.css and docs/STYLE_GUIDE.md.
 */

import { baseName, displayName } from "@/config/assets";
import { iconStyle } from "@/components/TokenIcon";
import { breakdown } from "@/lib/breakdown";
import { formatDate, tokenAmount, usd } from "@/lib/format";
import { TYPE_LABEL } from "@/lib/strategyTypes";
import type { Leg, RiskLevel, Strategy } from "@/lib/engine/types";
import { SITE_URL } from "./share";

const W = 1200;
const H = 675;
const SCALE = 2;

const C = {
  ink: "#ffffff",
  secondary: "#d4cedc",
  muted: "#a194b3",
  label: "rgba(178,189,224,0.9)",
  lavender: "#e5cdfe",
  violet: "#9a5cff",
  reward: "#bae6fd",
  dust: "#c757d8",
  mon: "#6e54ff",
  low: "#34d399",
};
const RISK: Record<RiskLevel, string> = { Low: "#34d399", Medium: "#f4b256", High: "#fb7185" };
const REWARD_COLOR: Record<string, string> = { DUST: C.dust, MON: C.mon };
const ROLE: Record<Leg["role"], string> = { deposit: "Deposit", borrow: "Borrow", lend: "Lend" };

type Ctx = CanvasRenderingContext2D;

/** The family names next/font registered, read from the CSS variables set on <html>. */
function fontFamilies() {
  const css = getComputedStyle(document.documentElement);
  return {
    sans: css.getPropertyValue("--font-quicksand").trim() || "ui-sans-serif, system-ui, sans-serif",
    display: css.getPropertyValue("--font-cinzel").trim() || "serif",
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** A CSS colour, or a vertical canvas gradient from a "linear-gradient(180deg, …)" string. */
function paint(ctx: Ctx, css: string, top: number, bottom: number): string | CanvasGradient {
  if (!css.startsWith("linear-gradient")) return css;
  const stops = css.match(/#[0-9a-f]{3,8}/gi) ?? ["#000"];
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach((c, i) => g.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, c));
  return g;
}

function circle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Same look as components/TokenIcon: symbol on a coloured circle with a coloured ring. */
function drawIcon(ctx: Ctx, icons: Map<string, HTMLImageElement>, symbol: string, x: number, y: number, size: number) {
  const { src, style: s } = iconStyle(symbol);
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  const ring = s.ringWeight ? Math.max(1, Math.round((size / 24) * s.ringWeight)) : 0;
  circle(ctx, cx, cy, r);
  ctx.fillStyle = paint(ctx, s.ring, y, y + size);
  ctx.fill();
  circle(ctx, cx, cy, r - ring);
  ctx.fillStyle = paint(ctx, s.bg, y, y + size);
  ctx.fill();
  const img = icons.get(src);
  if (!img) return;
  ctx.save();
  circle(ctx, cx, cy, r - ring);
  ctx.clip();
  const inner = size * s.scale;
  ctx.drawImage(img, cx - inner / 2 + (s.offsetX ?? 0) * size, cy - inner / 2 + (s.offsetY ?? 0) * size, inner, inner);
  ctx.restore();
}

function setFont(ctx: Ctx, weight: number, px: number, family: string, spacing = 0) {
  ctx.font = `${weight} ${px}px ${family}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
}

/** Splits text into at most `max` lines that fit `width`, ending with "…" if it had to cut. */
function wrap(ctx: Ctx, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === max) {
      let last = lines[max - 1];
      while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
      lines[max - 1] = `${last.trimEnd()}…`;
      return lines;
    }
  }
  lines.push(line);
  return lines;
}

/** A rounded chip with a tinted fill and ring, like the UI's badges. Returns its width. */
function chip(ctx: Ctx, text: string, x: number, cy: number, color: string, font: string, dot = false, small = false) {
  setFont(ctx, 600, small ? 15 : 18, font);
  const pad = small ? 12 : 16;
  const dotSpace = dot ? (small ? 13 : 16) : 0;
  const w = ctx.measureText(text).width + pad * 2 + dotSpace;
  const h = small ? 30 : 38;
  const left = x;
  roundRect(ctx, left, cy - h / 2, w, h, h / 2);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  if (dot) {
    circle(ctx, left + pad + (small ? 3 : 4), cy, small ? 3 : 4);
    ctx.fill();
  }
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + pad + dotSpace, cy + 1);
  return w;
}

function arrow(ctx: Ctx, x: number, cy: number, loop: boolean) {
  const s = 32 / 24;
  const oy = cy - 16;
  ctx.save();
  ctx.translate(x, oy);
  ctx.scale(s, s);
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (loop) {
    ctx.moveTo(4, 9); ctx.lineTo(17, 9); ctx.lineTo(14, 6);
    ctx.moveTo(20, 15); ctx.lineTo(7, 15); ctx.lineTo(10, 18);
  } else {
    ctx.moveTo(5, 12); ctx.lineTo(19, 12);
    ctx.moveTo(14, 7); ctx.lineTo(19, 12); ctx.lineTo(14, 17);
  }
  ctx.stroke();
  ctx.restore();
}

export async function renderShareCard(s: Strategy, principalUsd: number, fetchedAt?: string): Promise<Blob> {
  const font = fontFamilies();
  await Promise.all(
    [`600 40px ${font.sans}`, `500 20px ${font.sans}`, `700 20px ${font.sans}`, `400 26px ${font.display}`].map((f) =>
      document.fonts.load(f).catch(() => []),
    ),
  );

  const legs = ["deposit", "borrow", "lend"]
    .map((role) => s.legs.find((l) => l.role === role))
    .filter((l): l is Leg => !!l);
  const { earnedByToken, rewards, held, earned, positive } = breakdown(s);
  // Legend groups: "Interest" once with its tokens, then each liquid reward token in its bar colour.
  const legend: { label: string; color: string; tokens: string[] }[] = [
    { label: "Interest", color: "rgba(255,255,255,0.85)", tokens: earnedByToken.filter(([, v]) => v > 0).map(([t]) => t) },
    ...rewards.map(([t]) => ({ label: "Rewards", color: REWARD_COLOR[t] ?? C.reward, tokens: [t] })),
  ].filter((g) => g.tokens.length);
  // A missing icon just leaves its coloured circle.
  const srcs = new Set([...legs.map((l) => l.symbol), ...legend.flatMap((g) => g.tokens), ...held.map(([t]) => t)].map((t) => iconStyle(t).src));
  const icons = new Map<string, HTMLImageElement>();
  await Promise.all([...srcs].map((src) => loadImage(src).then((img) => icons.set(src, img), () => {})));

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // Page backdrop with violet glows.
  const bg = ctx.createLinearGradient(0, 0, W, H * 0.6);
  bg.addColorStop(0, "#2e0958");
  bg.addColorStop(0.5, "#10002c");
  bg.addColorStop(1, "#200041");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [gx, gy, r, color] of [
    [140, 0, 520, "rgba(126,99,255,0.28)"],
    [960, 30, 460, "rgba(180,82,255,0.3)"],
  ] as const) {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Card panel.
  const P = { x: 40, y: 40, w: W - 80, h: H - 80 };
  roundRect(ctx, P.x, P.y, P.w, P.h, 36);
  const card = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
  card.addColorStop(0, "rgba(55,15,100,0.92)");
  card.addColorStop(1, "rgba(42,11,81,0.92)");
  ctx.fillStyle = card;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const L = P.x + 56;
  const R = P.x + P.w - 56;
  const width = R - L;
  ctx.textAlign = "left";

  // Brand.
  ctx.textBaseline = "middle";
  setFont(ctx, 400, 24, font.display, 1.5);
  const brand = ctx.createLinearGradient(0, 80, 0, 110);
  brand.addColorStop(0, C.ink);
  brand.addColorStop(1, C.lavender);
  ctx.fillStyle = brand;
  ctx.fillText("Wisdom of the Wind", L, 98);

  // Type and name.
  ctx.textBaseline = "alphabetic";
  setFont(ctx, 600, 14, font.sans, 2.5);
  ctx.fillStyle = C.label;
  const typeText = TYPE_LABEL[s.type].toUpperCase();
  ctx.fillText(typeText, L, 162);
  // Risk sits right after the type, as one line describing the strategy.
  chip(ctx, `${s.risk} risk`, L + ctx.measureText(typeText).width + 14, 157, RISK[s.risk], font.sans, true, true);
  ctx.textBaseline = "alphabetic";
  // Two-line names drop a size so the flow row keeps clear of the earnings below.
  setFont(ctx, 600, 40, font.sans, 0.5);
  let nameLines = wrap(ctx, s.text.name, width, 1);
  let lineH = 50;
  if (nameLines[0].endsWith("…")) {
    setFont(ctx, 600, 34, font.sans, 0.5);
    nameLines = wrap(ctx, s.text.name, width, 2);
    lineH = 42;
  }
  ctx.fillStyle = C.ink;
  nameLines.forEach((line, i) => ctx.fillText(line, L, 210 + i * lineH));

  // Flow: token pills joined by arrows.
  const flowY = 210 + (nameLines.length - 1) * lineH + 32;
  const pillH = 74;
  const cy = flowY + pillH / 2;
  const loop = s.type === "yieldLoop";
  let x = L;
  legs.forEach((leg, i) => {
    if (i > 0) {
      arrow(ctx, x + 6, cy, loop && leg.role === "borrow");
      x += 44;
    }
    setFont(ctx, 700, 26, font.sans);
    const name = displayName(leg.symbol);
    const nameW = ctx.measureText(name).width;
    setFont(ctx, 600, 13, font.sans, 2);
    const roleText = ROLE[leg.role].toUpperCase();
    const pillW = Math.max(ctx.measureText(roleText).width, 32 + 10 + nameW) + 36;
    roundRect(ctx, x, flowY, pillW, pillH, 18);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(roleText, x + 18, flowY + 26);
    drawIcon(ctx, icons, leg.symbol, x + 18, flowY + 34, 28);
    setFont(ctx, 700, 26, font.sans);
    ctx.fillStyle = C.ink;
    ctx.fillText(name, x + 18 + 28 + 10, flowY + 58);
    x += pillW;
  });
  const borrow = legs.find((l) => l.role === "borrow");
  if (loop && borrow) {
    const deposit = legs[0];
    const n = (deposit.amountUsd / (deposit.amountUsd - borrow.amountUsd)).toFixed(1);
    chip(ctx, `×${n} loop`, x + 18, cy, C.lavender, font.sans);
  } else if (!borrow) {
    chip(ctx, "No borrowing", x + 18, cy, C.low, font.sans);
  }

  // Hero: yearly dollars on the user's amount.
  const heroY = 470;
  setFont(ctx, 600, 15, font.sans, 2.5);
  ctx.fillStyle = C.label;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("YOU COULD EARN", L, heroY - 74);
  setFont(ctx, 700, 80, font.sans);
  ctx.fillStyle = C.ink;
  const hero = usd(s.earnings.net);
  ctx.fillText(hero, L, heroY);
  const heroW = ctx.measureText(hero).width;
  setFont(ctx, 500, 26, font.sans);
  ctx.fillStyle = C.muted;
  ctx.fillText(`a year on ${usd(principalUsd)}`, L + heroW + 16, heroY);
  setFont(ctx, 600, 30, font.sans);
  ctx.fillStyle = C.secondary;
  ctx.textAlign = "right";
  ctx.fillText(`${((s.earnings.net / principalUsd) * 100).toFixed(1)}%`, R, heroY - 22);
  setFont(ctx, 500, 18, font.sans);
  ctx.fillStyle = C.muted;
  ctx.fillText("a year", R, heroY);
  ctx.textAlign = "left";

  // Earnings bar: interest, then reward tokens (DUST last), as in EarningsBreakdown.
  const barY = heroY + 26;
  ctx.save();
  roundRect(ctx, L, barY, width, 12, 6);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();
  ctx.clip();
  let bx = L;
  const segments: [number, string][] = [
    [earned, "rgba(255,255,255,0.85)"],
    ...rewards.map(([t, v]): [number, string] => [v, REWARD_COLOR[t] ?? C.reward]),
  ];
  for (const [v, color] of segments) {
    const w = positive > 0 ? Math.max(0, (v / positive) * width) : 0;
    ctx.fillStyle = color;
    ctx.fillRect(bx, barY, w, 12);
    bx += w;
  }
  ctx.restore();

  // Legend: which token each part is paid in.
  let lx = L;
  const ly = barY + 40;
  setFont(ctx, 500, 18, font.sans);
  ctx.textBaseline = "middle";
  for (const { label, color, tokens } of legend) {
    circle(ctx, lx + 5, ly, 5);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.fillText(label, lx + 18, ly + 1);
    lx += 18 + ctx.measureText(label).width + 8;
    for (const token of tokens) {
      drawIcon(ctx, icons, token, lx, ly - 10, 20);
      lx += 26;
      ctx.fillStyle = C.secondary;
      const t = baseName(token);
      ctx.fillText(t, lx, ly + 1);
      lx += ctx.measureText(t).width + 12;
    }
    lx += 16;
  }

  // DUST in tokens, apart from the dollars: your piece of Neverland, as below the Total in the app.
  // Drawn right to left; it drops to its own line if the legend leaves no room.
  const pieceLabel = "Your piece of Neverland";
  const heldWidth = () => {
    setFont(ctx, 500, 18, font.sans);
    let w = ctx.measureText(pieceLabel).width;
    for (const [token, n] of held) {
      setFont(ctx, 700, 18, font.sans);
      w += 8 + ctx.measureText(`+${tokenAmount(n)}`).width + 26 + 6;
      setFont(ctx, 600, 18, font.sans);
      w += ctx.measureText(token).width;
    }
    return w;
  };
  const hy = held.length && R - heldWidth() < lx ? ly + 30 : ly;
  let rx = R;
  ctx.textAlign = "right";
  for (const [token, n] of [...held].reverse()) {
    setFont(ctx, 600, 18, font.sans);
    ctx.fillStyle = C.secondary;
    ctx.fillText(token, rx, hy + 1);
    rx -= ctx.measureText(token).width + 6;
    drawIcon(ctx, icons, token, rx - 20, hy - 10, 20);
    rx -= 26;
    setFont(ctx, 700, 18, font.sans);
    ctx.fillStyle = REWARD_COLOR[token] ?? C.reward;
    const amount = `+${tokenAmount(n)}`;
    ctx.fillText(amount, rx, hy + 1);
    rx -= ctx.measureText(amount).width + 8;
  }
  if (held.length) {
    setFont(ctx, 500, 18, font.sans);
    ctx.fillStyle = C.muted;
    ctx.fillText(pieceLabel, rx, hy + 1);
  }
  ctx.textAlign = "left";

  // Footer.
  const fy = P.y + P.h - 34;
  setFont(ctx, 500, 16, font.sans);
  ctx.fillStyle = C.muted;
  ctx.fillText(`Live rates · ${formatDate(fetchedAt ?? new Date().toISOString())} · Not financial advice`, L, fy);
  ctx.textAlign = "right";
  setFont(ctx, 600, 18, font.sans);
  ctx.fillStyle = C.lavender;
  ctx.fillText(SITE_URL.replace("https://", ""), R, fy);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't draw the card."))), "image/png"),
  );
}

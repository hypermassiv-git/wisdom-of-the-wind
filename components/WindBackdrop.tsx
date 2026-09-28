import type { CSSProperties } from "react";

/** Drifting light motes, fixed so server and browser render the same thing. [left%, top%, size px, delay s, duration s] */
const MOTES: [number, number, number, number, number][] = [
  [6, 22, 3, 0, 14], [14, 58, 2, 3, 17], [22, 34, 4, 6, 15], [31, 70, 2, 1.5, 19],
  [38, 18, 3, 8, 16], [46, 48, 2, 4, 13], [53, 76, 3, 10, 18], [61, 28, 2, 2, 15],
  [68, 60, 4, 7, 17], [74, 14, 2, 5, 14], [81, 42, 3, 0.5, 16], [88, 68, 2, 9, 19],
  [93, 30, 3, 3.5, 15], [10, 84, 2, 11, 18], [57, 8, 2, 6.5, 14], [84, 86, 3, 12, 17],
];

/**
 * Decorative full-screen background: a soft glow and slowly drifting motes of light.
 * Pinned to the viewport so it covers the whole page while scrolling. Hidden from assistive tech.
 */
export function WindBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute left-1/2 top-24 h-72 w-[42rem] max-w-[120vw] -translate-x-1/2">
        <div className="glow-pulse h-full w-full rounded-full bg-violet/25 blur-3xl" />
      </div>
      {MOTES.map(([left, top, size, delay, dur], i) => (
        <span
          key={i}
          className="mote absolute rounded-full bg-lavender"
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              boxShadow: `0 0 ${size * 4}px ${size}px rgba(229,205,254,0.35)`,
              "--d": `${delay}s`,
              "--dur": `${dur}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

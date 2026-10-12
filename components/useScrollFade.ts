"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

const FADE = "48px";

/**
 * For a row that scrolls sideways on phones: fades whichever end has more to scroll to, so it's
 * clear the row scrolls. Spread `props` onto the row and give it the `scroll-fade` class.
 */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const r = ref.current;
    if (!r) return;
    const left = r.scrollLeft > 1;
    const right = r.scrollLeft + r.clientWidth < r.scrollWidth - 1;
    setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
  }, []);

  // After every render, in case the chips changed; the state only changes when an end does.
  useEffect(update);

  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    const ro = new ResizeObserver(update);
    ro.observe(r);
    return () => ro.disconnect();
  }, [update]);

  const style = { "--fade-l": more.left ? FADE : "0px", "--fade-r": more.right ? FADE : "0px" } as CSSProperties;
  return { ref, props: { ref, onScroll: update, style } };
}

/**
 * Ref callback for a sideways-scrolling row: marks which edges still have more to see,
 * so `.scroll-fade` can fade them. Returns its cleanup (React 19 ref cleanup).
 */
export function scrollFade(el: HTMLElement | null) {
  if (!el) return;
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.toggleAttribute("data-fade-start", el.scrollLeft > 1);
    el.toggleAttribute("data-fade-end", el.scrollLeft < max - 1);
  };
  update();
  el.addEventListener("scroll", update, { passive: true });
  const resize = new ResizeObserver(update);
  resize.observe(el);
  return () => {
    el.removeEventListener("scroll", update);
    resize.disconnect();
  };
}

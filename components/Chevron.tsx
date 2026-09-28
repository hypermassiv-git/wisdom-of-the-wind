/** Dropdown arrow for <details> accordions. Rotates when the parent `group` is open. */
export function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

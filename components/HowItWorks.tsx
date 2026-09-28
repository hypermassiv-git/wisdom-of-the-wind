const STEPS = [
  {
    title: "Tell us your budget",
    body: "Enter any amount to see example earnings.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5V8m0 8v1.5" />
      </>
    ),
  },
  {
    title: "See possible strategies",
    body: "What each strategy pays, costs and risks.",
    icon: <path d="M4 20V10m6 10V4m6 16v-7m4 7H3" />,
  },
  {
    title: "Follow the steps",
    body: "A plain walkthrough to do it in Neverland.",
    icon: (
      <>
        <path d="M5 12h12m-5-5 5 5-5 5" />
        <path d="M20 5v14" />
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <ol className="mx-auto mt-14 grid max-w-3xl gap-3 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="panel flex items-start gap-3 p-4 text-left sm:flex-col sm:gap-3 sm:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender/[0.14] text-lavender">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {s.icon}
            </svg>
          </span>
          <span>
            <span className="text-xs font-semibold tabular-nums text-ink-muted">Step {i + 1}</span>
            <span className="mt-0.5 block font-semibold">{s.title}</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-ink-secondary">{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

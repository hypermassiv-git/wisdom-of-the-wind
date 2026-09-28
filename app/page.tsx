import { Disclaimer } from "@/components/Disclaimer";
import { StrategyFinder } from "@/components/StrategyFinder";
import { WindBackdrop } from "@/components/WindBackdrop";

export default function Home() {
  return (
    <div className="relative isolate overflow-x-clip">
      <WindBackdrop />
      <main className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="rise text-gradient font-display text-4xl leading-tight tracking-title sm:text-5xl lg:text-6xl">
            Wisdom of the Wind
          </h1>
          <p
            className="rise mt-5 text-lg leading-relaxed text-ink-secondary sm:text-xl"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            The top Neverland strategies right now, ranked using live rates.
          </p>
          <p className="rise mt-3 text-sm text-ink-secondary" style={{ "--d": "180ms" } as React.CSSProperties}>
            Made with love{" "}
            <svg
              viewBox="0 0 24 24"
              className="heartbeat inline-block size-4 -translate-y-px align-middle text-[#ff7eb6] drop-shadow-[0_0_6px_rgba(255,126,182,0.6)]"
              fill="currentColor"
              aria-label="love"
              role="img"
            >
              <path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3.1 1.8-2 3.3-3.1 5.4-3.1 3.6 0 5.7 3.7 4.2 7.1C19.5 16.4 12 21 12 21z" />
            </svg>{" "}
            by{" "}
            <a
              href="https://x.com/hypermassiv"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline decoration-white/30 underline-offset-4 transition-colors hover:text-ink hover:decoration-white/70"
            >
              Hyper
            </a>
          </p>
        </div>
        <StrategyFinder />
      </main>
      <Disclaimer />
    </div>
  );
}

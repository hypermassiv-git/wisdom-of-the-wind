"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export interface ShareCardFile {
  url: string;
  fileName: string;
  /** The image also made it to the clipboard, so it can be pasted. */
  copied: boolean;
  /** Link to X's composer with the post text filled in. */
  intentUrl: string;
  /** Set on phones: the card isn't saved yet, and step 1 saves it (share sheet → Save Image). */
  file?: File;
  /** Set on phones: opens the X app's composer, where the user is already signed in. */
  appUrl?: string;
}

/** Step-by-step guide for attaching the downloaded card to an X post (X's post link can't carry an image). */
export function ShareModal({ card, onClose }: { card: ShareCardFile; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const mobile = !!card.file;
  // On computers, step 1 (download) is done by the time this opens.
  const [step, setStep] = useState(mobile ? 1 : 2);
  const [paste, setPaste] = useState("Ctrl+V");
  // The X app didn't open (not installed?), so offer X in the browser.
  const [noApp, setNoApp] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setPaste("⌘V");
  }, []);

  function download() {
    const a = document.createElement("a");
    a.href = card.url;
    a.download = card.fileName;
    a.click();
  }

  /** Phones: open the X app. If the page is still showing a moment later, the app didn't open. */
  function openApp() {
    window.location.href = card.appUrl!;
    setStep(3);
    setTimeout(() => {
      if (document.visibilityState === "visible") setNoApp(true);
    }, 1500);
  }

  /** Phones: the share sheet offers "Save Image" (to Photos). Without file sharing, download it instead. */
  async function save() {
    const files = [card.file!];
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        download();
      }
    } else {
      download();
    }
    setStep(2);
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-labelledby="share-title"
      className="panel m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100%-2rem),30rem)] overflow-y-auto p-5 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="share-title" className="text-lg font-semibold tracking-[0.02em]">
          Share on X
        </h2>
        <button
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.url}
        alt="Your strategy card"
        className="mt-4 aspect-[16/9] w-full rounded-panel ring-1 ring-white/10"
      />

      <ol className="mt-5 space-y-1">
        {mobile ? (
          <Step n={1} step={step} title="Save the card">
            <p>Tap Save card, then choose Save Image. Or press and hold the card above to save it.</p>
            {step === 1 && (
              <button onClick={save} className="btn-primary mt-3 h-10 px-5 text-sm">
                Save card
              </button>
            )}
          </Step>
        ) : (
          <Step n={1} step={step} title="Your card is downloaded">
            <p>
              Saved as <span className="break-all text-ink-secondary">{card.fileName}</span>.
              {card.copied && " It's also copied, ready to paste."}
            </p>
            <button onClick={download} className="mt-1 text-xs underline underline-offset-2 hover:text-ink">
              Download again
            </button>
          </Step>
        )}
        <Step n={2} step={step} title="Open X">
          <p>Your post is written for you and tags @Neverland_Money.</p>
          {step === 2 &&
            (card.appUrl ? (
              <button onClick={openApp} className="btn-primary mt-3 h-10 px-5 text-sm">
                Open X app <span aria-hidden>↗</span>
              </button>
            ) : (
              <a
                href={card.intentUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setStep(3)}
                className="btn-primary mt-3 h-10 px-5 text-sm"
              >
                Open X post <span aria-hidden>↗</span>
              </a>
            ))}
          {noApp && (
            <p className="mt-2 text-xs">
              X app didn&apos;t open?{" "}
              <a
                href={card.intentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                Post from the browser instead
              </a>
              .
            </p>
          )}
        </Step>
        <Step n={3} step={step} title="Attach the card">
          {mobile ? (
            <p>In X, tap the photo icon under your post and pick the card from your Photos.</p>
          ) : card.copied ? (
            <p>
              Click in the post and press <Key>{paste}</Key> to paste it. Or click the image icon and pick the file
              from your Downloads.
            </p>
          ) : (
            <p>Click the image icon under your post and pick the file from your Downloads.</p>
          )}
          {step === 3 && (
            <button onClick={() => setStep(4)} className="btn-ghost mt-3 h-9 text-[13px]">
              Done, it&apos;s attached
            </button>
          )}
        </Step>
        <Step n={4} step={step} title="Post it" last>
          <p>Check the card shows in your post, then hit Post.</p>
          {step === 4 && (
            <button onClick={() => ref.current?.close()} className="btn-ghost mt-3 h-9 text-[13px]">
              Finish
            </button>
          )}
        </Step>
      </ol>
      {step <= 2 && (
        <button
          onClick={() => setStep(step + 1)}
          className="mt-2 text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          {step === 1 ? "Already saved it? Skip to the next step" : "X is already open? Skip to the next step"}
        </button>
      )}
    </dialog>
  );
}

function Step({
  n,
  step,
  title,
  last,
  children,
}: {
  n: number;
  step: number;
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  const done = n < step;
  const current = n === step;
  return (
    <li className="flex gap-3" aria-current={current ? "step" : undefined}>
      <div className="flex flex-col items-center">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums transition-colors ${
            done
              ? "bg-violet text-ink"
              : current
                ? "bg-violet/20 text-lavender ring-2 ring-violet-strong"
                : "bg-white/5 text-ink-muted ring-1 ring-white/10"
          }`}
        >
          {done ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Done">
              <path d="m5 12 5 5 9-10" />
            </svg>
          ) : (
            n
          )}
        </span>
        {!last && <span className={`mt-1 w-px flex-1 ${done ? "bg-violet/60" : "bg-white/10"}`} aria-hidden />}
      </div>
      <div className={`min-w-0 pb-4 text-sm leading-relaxed ${current ? "text-ink-secondary" : "text-ink-muted"}`}>
        <h3 className={`text-[15px] font-semibold ${current || done ? "text-ink" : "text-ink-muted"}`}>{title}</h3>
        <div className="mt-0.5">{children}</div>
      </div>
    </li>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-xs font-semibold text-ink ring-1 ring-white/15">
      {children}
    </kbd>
  );
}

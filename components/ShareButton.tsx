"use client";

import { useEffect, useState } from "react";
import type { Strategy } from "@/lib/engine/types";
import { shareFileName, shareText, xAppUrl, xIntentUrl } from "@/lib/share";
import { renderShareCard } from "@/lib/shareCard";
import { type ShareCardFile, ShareModal } from "./ShareModal";

/** Copies the image while the click still counts as the user's action (Safari needs the promise form). */
function copyImage(blob: Promise<Blob>): Promise<boolean> {
  try {
    return navigator.clipboard
      .write([new ClipboardItem({ "image/png": blob })])
      .then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * "Share on X": draws the strategy as an image, copies it, and opens a step-by-step guide to paste it into a post.
 * If the copy doesn't work in this browser, the guide's first step lets the user copy (or save) it by hand.
 */
export function ShareButton({ s, principalUsd, fetchedAt }: { s: Strategy; principalUsd: number; fetchedAt?: string }) {
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<ShareCardFile | null>(null);

  useEffect(() => () => {
    if (card) URL.revokeObjectURL(card.url);
  }, [card]);

  async function share() {
    if (busy) return;
    setBusy(true);
    const text = shareText(s);
    const blob = renderShareCard(s, principalUsd, fetchedAt);
    const mobile = matchMedia("(pointer: coarse)").matches;
    const copied = copyImage(blob);
    try {
      const png = await blob;
      setCard({
        url: URL.createObjectURL(png),
        png,
        fileName: shareFileName(s),
        copied,
        intentUrl: xIntentUrl(text),
        appUrl: mobile ? xAppUrl(text) : undefined,
        mobile,
      });
    } catch {
      alert("Sorry, the card couldn't be made. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={share}
        disabled={busy}
        aria-label="Share on X"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink-secondary ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-ink disabled:cursor-wait disabled:opacity-60"
      >
        <span aria-hidden>{busy ? "Making card…" : "Share on"}</span>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>
      {card && <ShareModal card={card} onClose={() => setCard(null)} />}
    </>
  );
}

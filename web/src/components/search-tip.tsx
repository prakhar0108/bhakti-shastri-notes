"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchContext } from "fumadocs-ui/contexts/search";

const STORAGE_KEY = "bs-notes:search-tip-seen";

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-8 items-center justify-center rounded-md border border-fd-border bg-fd-muted px-2 py-1 font-sans text-sm font-semibold text-fd-foreground shadow-[0_2px_0_var(--color-fd-border)]">
      {children}
    </kbd>
  );
}

/** One-time welcome pop-up that introduces the site-wide search and its shortcut. */
export function SearchTip() {
  const { enabled, setOpenSearch } = useSearchContext();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage can be blocked (private mode); just show the tip.
    }
    if (seen) return;
    const timer = window.setTimeout(() => {
      setIsMac(/Mac|iPhone|iPad/i.test(navigator.userAgent));
      setOpen(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore: the tip will simply show again next visit.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  function trySearch() {
    dismiss();
    setOpenSearch(true);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-fd-overlay p-4 backdrop-blur-sm sm:items-center print:hidden"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-tip-title"
        className="w-full max-w-md rounded-2xl border border-fd-border bg-fd-popover p-6 text-fd-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2
            id="search-tip-title"
            className="font-heading text-2xl font-semibold leading-tight"
          >
            Find exactly what you need
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={dismiss}
            className="rounded-full px-2 text-xl leading-none text-fd-muted-foreground hover:text-fd-foreground"
          >
            ×
          </button>
        </div>

        <p className="text-sm leading-relaxed text-fd-muted-foreground">
          These notes come with a full-text search. Open it from anywhere on
          the site:
        </p>

        <div className="my-4 flex items-center justify-center gap-2">
          <Key>{isMac ? "⌘" : "Ctrl"}</Key>
          <span className="text-fd-muted-foreground">+</span>
          <Key>K</Key>
        </div>

        <ul className="mb-5 space-y-2 text-sm leading-relaxed">
          <li>
            <strong>Searches inside every page</strong> — lecture notes, exam
            answers and analogies, not just page titles.
          </li>
          <li>
            <strong>Jumps to the exact section</strong> that matches, so you
            land on the paragraph you need instead of scrolling a long lecture.
          </li>
          <li>
            Try a verse number (<em>2.62</em>), a Sanskrit term (
            <em>guḍākeśa</em>), a topic (<em>six aggressors</em>) or an
            analogy (<em>snake charmer</em>).
          </li>
        </ul>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-fd-border px-4 py-2 text-sm font-medium hover:bg-fd-muted"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={trySearch}
            className="rounded-full bg-fd-primary px-4 py-2 text-sm font-semibold text-fd-primary-foreground hover:opacity-90"
          >
            Try search now
          </button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

/** Compact meta row: watch-on-YouTube button, language switch, and teacher credit. */
export function LectureMeta({
  href,
  translationHref,
  translationLabel,
  children,
}: {
  href?: string;
  translationHref?: string;
  translationLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2.5 rounded-full bg-[var(--color-brand-accent)] px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-md shadow-[var(--color-brand-accent)]/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--color-brand-accent)]/35"
        >
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs transition-colors group-hover:bg-white/30"
          >
            ▶
          </span>
          Watch on YouTube
        </a>
      )}
      {translationHref && translationLabel && (
        <Link
          href={translationHref}
          className="inline-flex items-center gap-2 rounded-full border border-fd-border px-4 py-2 text-sm font-medium text-fd-foreground no-underline transition-colors hover:border-[var(--color-brand-accent)] hover:text-[var(--color-brand-accent)]"
        >
          <span aria-hidden>🌐</span>
          {translationLabel}
        </Link>
      )}
      <span className="text-sm italic text-fd-muted-foreground">
        {children}
      </span>
    </div>
  );
}

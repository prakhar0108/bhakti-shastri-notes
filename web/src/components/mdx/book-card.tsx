import Image from "next/image";
import Link from "fumadocs-core/link";
import type { ReactNode } from "react";
import { asset } from "@/lib/shared";

/** Responsive grid for `BookCard`s: 4 columns wide, 2 on tablets, 1 on narrow phones. */
export function BookGrid({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </div>
  );
}

interface BookCardProps {
  href: string;
  title: string;
  cover: string;
  alt: string;
  status: string;
  available?: boolean;
}

/** Image-led card for a book in the library, linking to its overview page. */
export function BookCard({
  href,
  title,
  cover,
  alt,
  status,
  available = false,
}: BookCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-fd-border bg-fd-card transition-colors hover:border-[var(--color-gold)]/60 hover:bg-fd-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
    >
      <div className="relative aspect-[3/4] w-full bg-fd-muted">
        <Image
          src={asset(cover)}
          alt={alt}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-4"
        />
      </div>
      <div className="flex flex-1 flex-col items-center gap-1.5 p-4 text-center">
        <h3 className="font-heading text-base font-semibold text-fd-foreground">
          {title}
        </h3>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
            (available
              ? "bg-[var(--color-brand-accent)]/15 text-[var(--color-brand-accent)]"
              : "bg-fd-muted text-fd-muted-foreground")
          }
        >
          {status}
        </span>
      </div>
    </Link>
  );
}

/** Standalone, unlinked book cover shown on a book's own overview/coming-soon page. */
export function BookCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="not-prose mx-auto mb-6 w-full max-w-[200px]">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-fd-border bg-fd-muted">
        <Image
          src={asset(src)}
          alt={alt}
          fill
          sizes="200px"
          className="object-contain p-4"
        />
      </div>
    </div>
  );
}

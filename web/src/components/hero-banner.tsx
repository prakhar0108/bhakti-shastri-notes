import { BrandMark } from "@/components/brand-mark";

/** Devotional hero shown above the lecture index at `/docs`. */
export function HeroBanner() {
  return (
    <div className="not-prose mb-8 overflow-hidden rounded-2xl border border-fd-border/60 bg-gradient-to-br from-[var(--color-brand-accent)]/10 via-fd-card to-fd-background px-6 py-8 text-center sm:px-10">
      <BrandMark className="mx-auto mb-4 size-10 text-[var(--color-brand-accent)]" />
      <p
        lang="sa"
        className="font-devanagari text-xl text-fd-foreground sm:text-2xl"
      >
        कर्मण्येवाधिकारस्ते मा फलेषु कदाचन
      </p>
      <p className="mt-1.5 text-sm italic text-fd-muted-foreground">
        &ldquo;You have a right to perform your prescribed duties, but you are
        not entitled to the fruits of your actions.&rdquo; — Bhagavad-gītā 2.47
      </p>
      <div className="mx-auto mt-5 h-px w-16 bg-[var(--color-gold)]/50" />
    </div>
  );
}

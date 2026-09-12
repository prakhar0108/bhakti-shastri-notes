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
        मन्मना भव मद्भक्तो मद्याजी मां नमस्कुरु । मामेवैष्यसि सत्यं ते प्रतिजाने
        प्रियोऽसि मे ॥
      </p>
      <p className="mt-1.5 text-sm italic text-fd-muted-foreground">
        &ldquo;Always think of Me, become My devotee, worship Me and offer your
        homage unto Me. Thus you will come to Me without fail. I promise you
        this because you are My very dear friend.&rdquo; — Bhagavad-gītā 18.65
      </p>
      <div className="mx-auto mt-5 h-px w-16 bg-[var(--color-gold)]/50" />
    </div>
  );
}

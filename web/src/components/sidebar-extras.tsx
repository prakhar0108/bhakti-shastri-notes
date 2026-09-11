/** Small devotional epigraph shown above the sidebar navigation tree. */
export function SidebarBanner() {
  return (
    <div className="rounded-lg border border-fd-border/60 bg-fd-card/60 px-3 py-2.5 text-xs leading-relaxed text-fd-muted-foreground">
      <p
        lang="sa"
        className="font-devanagari text-[0.95rem] text-fd-foreground"
      >
        श्रीभगवानुवाच
      </p>
      <p className="mt-0.5 italic">&ldquo;The Blessed Lord said...&rdquo;</p>
    </div>
  );
}

/** Closing invocation shown at the bottom of the sidebar. */
export function SidebarFooter() {
  return (
    <p className="px-1 text-[0.7rem] leading-relaxed text-fd-muted-foreground/80">
      Hare Kṛṣṇa 🙏 Notes condensed from Bhakti Shastri lecture transcripts.
    </p>
  );
}

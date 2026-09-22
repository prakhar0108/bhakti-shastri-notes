import Image from "next/image";

/** Circular portrait of Srila Prabhupada shown at the top-right of the site. */
export function PrabhupadaAvatar({ className = "" }: { className?: string }) {
  return (
    <span
      className={`shrink-0 overflow-hidden rounded-full border border-fd-border/70 bg-fd-card shadow-sm ${className}`}
    >
      <Image
        src="/theme/prabhupada-header.png"
        alt="His Divine Grace A. C. Bhaktivedanta Swami Prabhupada"
        title="His Divine Grace A. C. Bhaktivedanta Swami Prabhupada"
        width={160}
        height={160}
        priority
        className="size-full origin-top scale-[1.6] object-cover"
      />
    </span>
  );
}

/** Desktop-only pinned avatar, since the docs layout has no top bar above `md`. */
export function PrabhupadaAvatarCorner() {
  return (
    <PrabhupadaAvatar className="fixed end-3 top-3 z-30 hidden size-[54px] md:block" />
  );
}

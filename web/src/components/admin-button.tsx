import Link from "next/link";

export function AdminButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/admin"
      prefetch={false}
      className={`rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-fd-accent ${className}`}
    >
      Admin
    </Link>
  );
}

/** Desktop-only, pinned left of the avatar since the docs layout has no top bar above `md`. */
export function AdminButtonCorner() {
  return (
    <AdminButton className="fixed end-[76px] top-[22px] z-30 hidden md:block" />
  );
}

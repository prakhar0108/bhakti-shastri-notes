import type { ComponentProps } from "react";

/** A minimal lotus glyph used as the site's brand mark. */
export function BrandMark(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M16 29c-5.5-2.6-8-7-8-11.5 0 0 4 2 8 7 4-5 8-7 8-7 0 4.5-2.5 8.9-8 11.5Z"
        fill="currentColor"
        className="text-fd-primary"
      />
      <path
        d="M16 20c-2.8-3.6-2.8-8 0-13 2.8 5 2.8 9.4 0 13Z"
        fill="currentColor"
        className="text-[var(--color-brand-accent)]"
      />
      <path
        d="M16 20c-3.6-1.4-7.6-.6-10.5 2.4 1.6-4.6 5.5-7.6 10.5-7.4-3 1.6-4.6 3.4-5.4 5.4 2-1 3.8-1.2 5.4-.4Z"
        fill="currentColor"
        className="text-fd-primary/70"
      />
      <path
        d="M16 20c3.6-1.4 7.6-.6 10.5 2.4-1.6-4.6-5.5-7.6-10.5-7.4 3 1.6 4.6 3.4 5.4 5.4-2-1-3.8-1.2-5.4-.4Z"
        fill="currentColor"
        className="text-fd-primary/70"
      />
    </svg>
  );
}

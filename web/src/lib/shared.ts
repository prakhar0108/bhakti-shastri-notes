export const appName = "Bhakti Shastri Notes";

/**
 * Prefixes a `public/` asset path with the deploy base path.
 * `next/image` does not apply `basePath` to unoptimized images (the GitHub Pages build).
 */
export function asset(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}

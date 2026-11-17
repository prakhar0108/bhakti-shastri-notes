import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// Only the hash of the private-page phrase is shipped to the browser.
const phrase = process.env.PRIVATE_PHRASE?.trim().toLowerCase();
const phraseHash = phrase
  ? createHash("sha256").update(phrase).digest("hex")
  : "";

// GitHub Pages serves from a project subpath and cannot run a Node server, so that
// target opts into a fully static export. Netlify keeps the default server build.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/bhakti-shastri-notes" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_PRIVATE_PHRASE_HASH: phraseHash,
  },
  ...(isGithubPages
    ? {
        output: "export" as const,
        basePath,
        images: { unoptimized: true },
      }
    : {}),
};

export default withMDX(nextConfig);

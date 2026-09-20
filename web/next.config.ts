import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

// GitHub Pages serves from a project subpath and cannot run a Node server, so that
// target opts into a fully static export. Netlify keeps the default server build.
const isGithubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGithubPages ? "/bhakti-shastri-notes" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
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

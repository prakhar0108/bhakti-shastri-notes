# Bhakti Shastri Notes — web UI

A [Fumadocs](https://fumadocs.dev) + Next.js site that renders the Bhakti Shastri lecture
notes from `../outputs/**/notes/*.md`.

## What it does

- **Source of truth stays in `../outputs/`.** `scripts/sync-notes.mjs` scans every
  `outputs/**/notes/*.md` file (plus its sibling `metadata.json`, if present) and
  (re)generates `content/docs/*.mdx`. It runs automatically before `dev` and `build`
  (`predev`/`prebuild`), so `content/docs/` is a build artifact — never edit it by hand.
- **Sidebar navigation** — one entry per lecture, ordered by "Day N" when present
  (`fumadocs-ui` `DocsLayout`).
- **Full-text search** — the sidebar search box hits `/api/search`
  (`fumadocs-core` search server).
- **Dark mode toggle** — built into the Fumadocs nav (light/dark/system).
- **Mermaid diagrams** — ` ```mermaid ` code fences render as diagrams
  (`src/components/mdx/mermaid.tsx`). The sync script also auto-generates flowcharts for:
  - the "Class Snapshot / One-Line Argument Map" section of each note, and
  - any legacy ASCII `│ / ▼` arrow-chain diagrams (e.g. "Cross-Shloka Conceptual Progression").
- **Math** — `$$...$$` blocks render via `remark-math` + KaTeX.

## Development

```bash
npm install
npm run dev      # syncs notes, then starts the dev server
```

```bash
npm run sync-notes   # regenerate content/docs/ from outputs/ without starting the server
npm run build         # syncs notes, then builds for production
```

## Deploy to Netlify

The repository-level `netlify.toml` configures Netlify to:

- use `web/` as the build base;
- install dependencies from `web/package-lock.json`;
- run `npm run build`, which regenerates the MDX content before compiling Next.js;
- publish the `.next` output using Node.js 22; and
- enable Next.js deployment skew protection.

To deploy, import the repository in Netlify and accept the settings from `netlify.toml`.
No environment variables or manually installed Next.js plugin are required. Netlify's maintained
OpenNext adapter automatically provisions the `/api/search` route and other Next.js runtime
features.

Every production deploy reads lecture sources from `outputs/`, so commit new or updated source
notes and shared verse files before triggering the build. Do not set a static export directory or
add a catch-all redirect; both would bypass Next.js route-handler support.

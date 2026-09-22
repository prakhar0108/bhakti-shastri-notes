---
applyTo: "outputs/**,web/scripts/sync-notes.mjs,web/src/components/mdx/**"
---

# Bhakti Shastri Notes — Generation & Formatting Rules

This file is the canonical reference for producing and editing lecture notes under `outputs/`.
It captures conventions established while building the Day 29–31 (BG 3.1–3.13) notes and the
Fumadocs site in `web/`. Read this before generating, restructuring, or reformatting any note.

## Do not use Gemini to write notes

**Notes are written by hand. The Gemini note-generation pass is retired and must not be used.**

- Do not run `uv run bs-notes <url>` for note generation, and do not call `app/gemini_notes.py`
  (or any other model-generated drafting step) to produce commentary. Only the transcript
  extraction half of the pipeline (`app/transcript.py`) is still used, to pull captions and lay
  out the lecture folder.
- Every lecture folder's `metadata.json` must record
  `"notes_generator": "manual-transcript-grounded-notes-plus-vedabase-verse-verification-no-gemini"`
  and a `grounding_rule` stating that commentary was written manually from the extracted
  captions without Gemini.
- The grounding contract itself is unchanged and still binding: never reconstruct, complete, or
  "correct" a Sanskrit verse from memory, and never introduce claims the transcript does not
  support. Writing the notes by hand tightens that contract; it does not relax it.

## Two separate passes — do not conflate them

1. **Transcript-grounded draft** (manual). Read the extracted transcript
   (`transcripts/<slug>-notes-source.md`, which carries the two-minute timestamp headers) end to
   end and write the commentary yourself, using only what the transcript actually says. Anything
   the captions garble goes to the repository-only `Transcript Verification Flags` section rather
   than being repaired from memory.
2. **Verse-verification & restructuring pass** (this document). A deliberate, separate step —
   performed only with live access to vedabase.io — that (a) adds a verified scripture reference
   for each shloka and (b) restructures the draft into the template below. Never invent verse
   text here either — always fetch it.

## Required note structure ("Day 31" template)

Every `outputs/**/notes/*.md` file should follow this section order:

````
# Day N | BG X.X – X.X | Karma-yoga | Bhakti Shastri Course

> **Source note:** <one consolidated disclaimer — see below>

---

## Class Snapshot & One-Line Argument Map

---

## Continuity & Recap from Preceding Class [...]

---

## Shloka-Wise Notes & Analytical Commentary

### Bhagavad-gita X.X [start – end]

<!-- verse:X.X -->

**Context.** ...

**Key Terms Explained by the Teacher**
- ...

#### <Reasoning sub-topic> [timestamps]
<one short paragraph>

<Callout type="idea" title="Takeaway">
... [timestamps]
</Callout>

---
(repeat per verse)

## Cross-Shloka Conceptual Progression (BG X.X – X.X)
```ascii arrow chain — auto-converted to a Mermaid flowchart by sync-notes.mjs```

### Comparative Summary Table
| Verse | Primary Theme | Core Sanskrit Terms Explained | Central Mechanism / Principle | Practical Imperative |

## Audience Q&A & Clarifications

## Last-Page Revision Sheet
### High-Yield Facts & Terminological Anchors
### Core Analogies & Metaphors

## Transcript Verification Flags
````

Notes on this template:

- Title uses an en dash (`–`) and `Karma-yoga` (one hyphenated word), matching
  `metadata.json`'s `title` field (which is what the sidebar/page title actually renders —
  see `extractDayNumber` / `loadMetadata` in `web/scripts/sync-notes.mjs`).
- The `> **Source note:**` blockquote is the **only** disclaimer in the file. State once that
  commentary is transcript-only and that verse text is separately verified against vedabase.io —
  do not repeat a disclaimer per verse.
- Each verse gets exactly one `<Callout type="idea" title="Takeaway">`. Do not box every
  paragraph in a callout.
- `Transcript Verification Flags` is repository-only editorial material. Keep the section in
  `outputs/**/notes/*.md`, but exclude it from generated website notes, navigation, and search
  content in `sync-notes.mjs`. Do not publish it as a callout or a collapsible section.
- Summarize the speaker's teachings, examples, and anecdotes respectfully and faithfully.
  Do not independently fact-check the speaker's statements unless explicitly requested, or add
  audience-facing caveats such as "unsourced claim", "not independently verified", or
  "not authenticated historical details". Ordinary attribution ("the teacher explains") is
  sufficient; do not frame the notes as an evaluation of the speaker's credibility.
- Keep transcription and editorial concerns in the repository-only flags section, not in
  audience-facing commentary. Do not invent missing details or silently repair uncertain
  captions. This does not relax the separate strict verification of exact scripture below.
- Use `####` sub-headings for each reasoning sub-topic instead of bold lead-ins buried inside one
  long bullet (e.g. prefer `#### Four levels of practitioners` + a bullet list over a single
  paragraph starting "Level 1 — ... Level 2 — ...").

## Verse sourcing protocol (strict)

- Every shloka reference **must be fetched and verified directly from**
  `https://vedabase.io/en/library/bg/<chapter>/<verse>/` at the time of writing. Never
  reconstruct Sanskrit, transliteration, word-for-word meanings, or the translation from memory,
  and never trust a previously-generated note's verse block as authoritative without
  re-checking it — verify verse-by-verse.
- Store each verified verse **once**, in `outputs/shared/verses/bg-<chapter>-<verse two-digit>.md`
  (e.g. `bg-3-07.md`), as a single self-closing component:

  ```mdx
  <Shloka
    number="3.7"
    href="https://vedabase.io/en/library/bg/3/7/"
    sanskrit={["...", "..."]}
    transliteration={["...", "..."]}
    synonyms={[["term", "meaning"], ...]}
    translation="..."
  />
  ```

  Preserve vedabase's exact line breaks, diacritics, word order, and speaker labels (e.g.
  `arjuna uvāca`) in each field. If any field can't be verified, leave the verse flagged as
  pending rather than filling it in.

- Reference the shared file from the lecture note with a placeholder comment —
  `<!-- verse:3.7 -->` — never inline the Sanskrit/translation text directly in a lecture note.
  `web/scripts/sync-notes.mjs` (`injectVerses` / `loadVerseBlock`) substitutes the shared block at
  sync time, so scripture text is stored exactly once even when a verse spans two lectures
  (e.g. BG 3.8 is covered at the end of Day 30 and the start of Day 31 — both notes reference
  the same `bg-3-08.md`, never a duplicate copy).

## Formatting rules

- **Lists over paragraphs:** whenever a passage names two or more parallel items (levels,
  senses, steps, examples, equivalences — "Level 1 — ...", "Eyes — ...", "the sacrificial fire is
  ..."), write it as a bullet or numbered list. Never flatten enumerable items into one prose
  paragraph.
- **Sanskrit/Hindi vocabulary in commentary** should be italic (`_term_`), not inline code
  (`` `term` ``) — inline code renders as a colored "chip" in the web UI
  (`web/src/app/globals.css`, `.prose :not(pre) > code`), which is meant for real code, not
  scripture vocabulary.
- **Timestamps** are unobtrusive anchors — `` `mm:ss` `` or `[mm:ss – mm:ss]` — placed near the
  claim or heading they support. Never invent a narrower timestamp than the transcript/prior
  note actually supports.
- Preserve `[exact Sanskrit omitted: auto-captions uncertain]`-style concerns from the transcript
  in the repository-only `Transcript Verification Flags` section, with their timestamps.
  In public commentary, retain the grounded explanation in plain language without these markers;
  never fill missing Sanskrit from memory or leave broken sentences or empty table cells.

## File & directory conventions

```
outputs/
├── <book>/                       # bhagavad-gita (one folder per course book)
│   └── chapter-NN/               # chapter-03 (zero-padded chapter number)
│       └── day-N-bg-X.X-X.X/     # day-31-bg-3.8-3.13 — one folder per class
│           ├── metadata.json     # video_url, video_id, title ("Day N | BG X.X - X.X | Karma - yoga | ..."),
│           │                     # duration, caption_language, line_count, notes_generator,
│           │                     # grounding_rule, plus transcript/notes paths relative to this folder
│           ├── transcripts/      # <lecture-slug>-clean-transcript.txt, <lecture-slug>-notes-source.md
│           ├── notes/            # <lecture-slug>-notes.md  <- the file this document governs
│           └── work/             # raw caption files (<lecture-slug>.<lang>.vtt)
└── shared/
    └── verses/                   # bg-<chapter>-<verse>.md, one canonical `<Shloka>` per verse
```

Every file inside a lecture folder is named after that folder's slug — never the YouTube video
id (the id lives in `metadata.json`). The slug also becomes the published page URL
(`day-31-bg-3.8-3.13-notes.md` → `/docs/day-31-bg-3-8-3-13`), so renaming a lecture folder
changes a live URL. `app/transcript.py` (`lecture_location`) derives the slug and folder from the
video title, so caption extraction writes straight into this layout; titles that don't match the
`Day N | BG X.X - X.X` shape fall back to `outputs/unsorted/<video-id>/`. `metadata.json` and the
`notes/` file are written by hand as part of the manual pass.

`metadata.json`'s `title` (not the note's own `#` heading) is what actually renders as the page
title and drives sidebar day-ordering (`extractDayNumber` in `web/scripts/sync-notes.mjs`) —
keep it in the `Day N | BG X.X - X.X | Karma - yoga | Bhakti Shastri Course` shape.

## Web rendering pipeline — things not to break

- `web/content/docs/` is **generated** by `npm run sync-notes` (also runs via `predev`/`prebuild`)
  from `outputs/**/notes/*.md`. Never hand-edit files under `content/docs/`.
- Available MDX components (registered in `web/src/components/mdx.tsx`): `Shloka`, `Callout`
  (+ `CalloutTitle`/`CalloutDescription`), `Mermaid`, `Cards`/`Card`, and standard Fumadocs
  defaults. Don't invent a new component name in a note without registering it there first.
- ASCII `│ / ▼` arrow-chain code fences and the Class-Snapshot "Argument Map" line are
  auto-converted to Mermaid flowcharts by `convertAsciiArrowDiagrams` /
  `injectArgumentMapFlowchart` in `sync-notes.mjs` — keep that shape when writing a
  Cross-Shloka Conceptual Progression block. The generator (a) keeps each node's **full wording**
  (verbose — timestamps and markdown are stripped from the box text, but sentences are never
  truncated or cut with an ellipsis) and (b) appends a `_How to read this: …_` caption plus a
  **numbered step-by-step explanation list** that repeats the full wording (with timestamps) for
  every box, so the reader always has an unambiguous, spelled-out reading of the diagram. Don't
  hand-write the caption or explanation list; the sync step generates them.
  - **Single-chain diagrams:** author each arrow-chain node as `BG X.X: <one clear sentence>` —
    the leading `BG X.X:` becomes the node/list label, the rest becomes the node body.
  - **Contrasting/multi-line arguments** (One-Line Argument Map with a `|`-separated second
    track) render as side-by-side Mermaid subgraphs, one column per track. Prefix each track with
    `Speaker or viewpoint: clause -> clause` (e.g. `Arjuna's assumption: knowledge -> stop
acting`) — the part before the first `:` becomes the column header, so pick a phrase that
    names _whose_ reasoning or _which_ position the column represents.
  - **Avoid ambiguous phrasing in the Argument Map line itself** — it is copied verbatim into
    both the flowchart nodes and the explanation list, so a vague clause (e.g. "knowledge-informed,
    unattached action") will confuse the reader in both places. Prefer explicit contrastive
    wording (e.g. "knowledge-guided action, without attachment to results") that stands on its own
    without the surrounding paragraph for context.
- After editing anything under `outputs/`, run `npm run sync-notes`, then `npm run build` and
  `npm run lint` from `web/` before considering the change done.

## Checklist for a new lecture

1. Extract the transcript only — no Gemini note generation. Read
   `transcripts/<slug>-notes-source.md` in full before writing anything.
2. Write `metadata.json` by hand: `video_url`, `video_id`, `title` in the
   `Day N | BG X.X - X.X | ...` shape, `speaker`, `duration` (from the last caption cue),
   `caption_language`, `line_count`, the three relative paths, and the no-Gemini
   `notes_generator` / `grounding_rule` values described above.
3. Write the note manually in the template above (Class Snapshot → Continuity →
   Shloka-Wise Notes → Cross-Shloka Progression + table → Q&A → Revision Sheet →
   Verification Flags).
4. For each shloka: fetch and verify it from vedabase.io, add/reuse its
   `outputs/shared/verses/bg-<chapter>-<verse>.md`, and reference it via `<!-- verse:X.X -->`.
   Reuse the shared file for any verse already covered by a prior lecture.
5. Apply the formatting rules above (lists over paragraphs, italics for vocabulary, one
   Takeaway callout per verse).
6. From `web/`: `npm run sync-notes && npm run build && npm run lint`; fix anything that breaks.

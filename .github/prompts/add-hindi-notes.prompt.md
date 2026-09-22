---
mode: agent
description: "Write the Hindi edition of a lecture note, grounded in the original Hindi transcript, and wire it into the site's Hindi sidebar tab."
---

# Add the Hindi edition of a lecture note

Tell me which day to do if I haven't said. The infrastructure already exists — Day 36
(`outputs/bhagavad-gita/chapter-03/day-36-bg-3.36-3.40/`) is the worked reference; copy its
shape rather than inventing a new one.

First read `.github/instructions/notes-generation.instructions.md`, especially the
**Hindi notes (`*-notes.hi.md`)** section. Everything below assumes those rules.

## The one thing to get right

The lectures are **delivered in Hindi** (`metadata.json` → `caption_language` is a
`*.hi-orig.vtt`). So the Hindi note is written **from the original Hindi transcript**
(`transcripts/<slug>-notes-source.md`), using the English note only as a structural template.

It is not a translation of the English note, and it is not a fresh interpretation either:

- Read the Hindi transcript end to end before writing a word.
- Cover exactly what the English note covers, in the same order, at the same depth.
- Introduce **no** claim the English note does not also make. If the English note is silent on
  something the transcript contains, the Hindi note is silent too — raise it with me instead.
- Do not fact-check or editorialize about the speaker.

## Steps

1. **Write** `outputs/<book>/chapter-NN/<day-folder>/notes/<slug>-notes.hi.md`.
   - Mirror the English note's section order, `####` sub-topics, bullet/table rows, the Mermaid
     arrow-chain shape, and exactly one `<Callout type="idea" title="सार">` per verse.
   - Timestamps must be **byte-identical** to the English note.
   - Keep the `<!-- verse:X.X -->` markers in the same positions — they resolve to the same
     English-verified `<Shloka>` blocks, because vedabase.io has no Hindi Gītā. State that in the
     Hindi source-note disclaimer; never fabricate a Hindi verse translation or gloss.
   - Keep `## Transcript Verification Flags`, `> **Source note:**` and
     `**One-Line Argument Map:**` literally in English (the sync script matches them verbatim);
     translate their _contents_.
   - Devanagari vocabulary in italics, never inline code.
2. **Update `metadata.json`**: add `title_hi`, `notes_path_hi`, and `hindi_notes_rule`. Change
   nothing else.
3. **Register the chapter in Hindi** if it's the first Hindi note for that chapter: add its title
   to `BG_CHAPTERS_HI` in `web/scripts/sync-notes.mjs`, taken from the note you just wrote — do
   not invent a title for a chapter you haven't translated.
4. **Verify.** From `web/`: `npm run sync-notes && npm run build && npm run lint`. Then check in a
   browser that:
   - `/docs/<slug>` (English) is unchanged and shows the `हिन्दी में पढ़ें` button.
   - `/docs/<slug>-hi` renders with verses injected, Mermaid intact, and **no**
     `Transcript Verification Flags` section.
   - The sidebar's हिन्दी tab lists the new day under its chapter.
   - Lint reports only the pre-existing errors in generated `.source/*` and `mermaid.tsx`.

## Report back

Which day was added, anything in the transcript the English note doesn't cover (don't add it —
list it), and any Hindi chapter title you had to introduce and where you sourced it from.

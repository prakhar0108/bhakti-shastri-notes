#!/usr/bin/env node
// Syncs Bhakti Shastri lecture notes from ../outputs/**/notes/*.md into content/docs/*.mdx.
// The markdown files under outputs/ remain the single source of truth; this script
// (re)generates the Fumadocs content directory from them on every `dev`/`build`.
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const OUTPUTS_DIR = path.join(REPO_ROOT, "outputs");
const CONTENT_DIR = path.join(WEB_ROOT, "content", "docs");
const VERSES_DIR = path.join(OUTPUTS_DIR, "shared", "verses");

const verseCache = new Map();

/** Load a canonical, vedabase.io-verified `<Shloka .../>` block for e.g. "3.7". */
async function loadVerseBlock(verseKey) {
  if (verseCache.has(verseKey)) return verseCache.get(verseKey);
  const [chapter, verse] = verseKey.split(".");
  const filePath = path.join(
    VERSES_DIR,
    `bg-${chapter}-${verse.padStart(2, "0")}.md`,
  );
  const content = (await pathExists(filePath))
    ? (await readFile(filePath, "utf8")).trim()
    : null;
  verseCache.set(verseKey, content);
  return content;
}

/** Replace `<!-- verse:3.7 -->` markers with the shared, verified verse reference. */
async function injectVerses(body) {
  const matches = [...body.matchAll(/<!--\s*verse:(\d+\.\d+)\s*-->/g)];
  let result = body;
  for (const match of matches) {
    const block = await loadVerseBlock(match[1]);
    if (block) result = result.replace(match[0], block);
  }
  return result;
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Recursively find every directory that directly contains a `notes/` subfolder with *.md files. */
async function findNoteGroups(dir, groups = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return groups;
  }

  const notesDir = entries.find((e) => e.isDirectory() && e.name === "notes");
  if (notesDir) {
    const notesPath = path.join(dir, "notes");
    const files = (await readdir(notesPath)).filter((f) => f.endsWith(".md"));
    if (files.length > 0) {
      groups.push({ parentDir: dir, notesDir: notesPath, files });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (["notes", "transcripts", "work", "shared"].includes(entry.name))
      continue;
    await findNoteGroups(path.join(dir, entry.name), groups);
  }

  return groups;
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractDayNumber(title) {
  const match = /day\s+(\d+)/i.exec(title ?? "");
  return match ? Number(match[1]) : null;
}

function stripLeadingHeading(body) {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === "") i++;
    return lines.slice(i).join("\n");
  }
  return body;
}

function escapeMermaidLabel(label) {
  return label
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/_/g, "")
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove `mm:ss` timestamp anchors (bracketed, parenthesised, or inline-code) from a label. */
function stripTimestamps(text) {
  return text
    .replace(
      /[[(]\s*`?\d{1,2}:\d{2}`?(\s*[–-]\s*`?\d{1,2}:\d{2}`?)?\s*[\])]/g,
      "",
    )
    .replace(/`\d{1,2}:\d{2}`(\s*[–-]\s*`\d{1,2}:\d{2}`)?/g, "")
    .replace(/\b\d{1,2}:\d{2}\b(\s*[–-]\s*\d{1,2}:\d{2})?/g, "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Clean a clause for use as a node label: strip timestamps/markdown, keep full wording (verbose). */
function conciseLabel(text) {
  return stripTimestamps(text).replace(/[*`_]/g, "").trim();
}

function splitProse(text) {
  let parts = text.split(/;\s+/);
  if (parts.length < 2) parts = text.split(/,\s*(?:which|therefore|and)\s+/i);
  if (parts.length < 2) parts = [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Emit a Mermaid flowchart followed by a "how to read this" caption and a numbered
 * step-by-step explanation list. `steps` is an array of `{ label, detail }`.
 */
function renderFlowchartWithExplanation(mermaidBody, caption, steps) {
  const out = ["```mermaid", mermaidBody, "```", "", `_${caption}_`, ""];
  steps.forEach((step, i) => {
    const lead = step.label ? `**${step.label}** — ` : "";
    const detail = step.detail.replace(/^([a-z])/, (m) => m.toUpperCase());
    out.push(`${i + 1}. ${lead}${detail}`);
  });
  return out.join("\n");
}

/** Build a single vertical arrow-chain flowchart + explanation from a list of node sentences. */
function buildArrowChainDiagram(nodes) {
  const mermaidLines = ["flowchart TD"];
  const steps = [];
  nodes.forEach((node, i) => {
    const verseMatch = /^(BG\s*\d+\.\d+)\s*[:\-–]\s*(.*)$/i.exec(node.trim());
    const label = verseMatch
      ? `${verseMatch[1]}: ${conciseLabel(verseMatch[2])}`
      : conciseLabel(node);
    mermaidLines.push(`  N${i + 1}["${escapeMermaidLabel(label)}"]`);
    steps.push({
      label: verseMatch ? verseMatch[1].replace(/\s+/g, " ") : null,
      detail: (verseMatch ? verseMatch[2] : node).trim(),
    });
  });
  for (let i = 0; i < nodes.length - 1; i++) {
    mermaidLines.push(`  N${i + 1} --> N${i + 2}`);
  }
  return renderFlowchartWithExplanation(
    mermaidLines.join("\n"),
    "How to read this: each box is one step in the lecture's argument; follow the arrows from the opening premise down to the conclusion. Full wording for every step is listed below.",
    steps,
  );
}

/** Turn plain (unlabelled) ASCII "│ / ▼" arrow-chain code fences into Mermaid flowcharts. */
function convertAsciiArrowDiagrams(body) {
  return body.replace(/```\n([\s\S]*?)\n```/g, (full, content) => {
    if (!/[│▼]/.test(content)) return full;

    const nodes = [];
    let buffer = [];
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (line === "" || line === "│" || line === "▼") {
        if (buffer.length > 0) {
          nodes.push(buffer.join(" "));
          buffer = [];
        }
        continue;
      }
      buffer.push(line);
    }
    if (buffer.length > 0) nodes.push(buffer.join(" "));
    if (nodes.length < 2) return full;

    return buildArrowChainDiagram(nodes);
  });
}

/** Find the "Class Snapshot / Argument Map" section and append a Mermaid flowchart of its argument chain. */
function injectArgumentMapFlowchart(body) {
  const lines = body.split("\n");
  const headingRe = /^(#{2,4})\s+.*(class snapshot|argument)/i;

  let sectionStart = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = headingRe.exec(lines[i]);
    if (match) {
      sectionStart = i;
      level = match[1].length;
      break;
    }
  }
  if (sectionStart === -1) return body;

  let sectionEnd = lines.length;
  const nextHeadingRe = new RegExp(`^#{1,${level}}\\s+`);
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (nextHeadingRe.test(lines[i]) || lines[i].trim() === "---") {
      sectionEnd = i;
      break;
    }
  }
  const section = lines.slice(sectionStart, sectionEnd);

  let argumentText = null;
  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    const boldMatch = /^\s*-?\s*\*\*([^*]*argument[^*]*)\*\*:?\s*(.*)$/i.exec(
      line,
    );
    if (boldMatch) {
      argumentText = boldMatch[2]?.trim() || section[i + 1]?.trim() || null;
      break;
    }
    if (/^#{2,4}\s*argument in one line/i.test(line)) {
      const next = section.slice(i + 1).find((l) => l.trim() !== "");
      if (next) argumentText = next.replace(/`/g, "").trim();
      break;
    }
  }
  if (!argumentText) return body;

  const tracks = argumentText
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);

  const multiTrack = tracks.length > 1;
  const mermaidLines = [multiTrack ? "flowchart LR" : "flowchart TD"];
  const steps = [];
  tracks.forEach((track, trackIdx) => {
    const segments = (
      track.includes("->")
        ? track.split("->").map((s) => s.trim())
        : splitProse(track)
    ).map((s) => s.replace(/(?<!\d)`(?!\d)/g, "").trim());

    // In a multi-track (contrasting) map, lift a leading "Speaker:" prefix into a
    // column header so each reasoning chain is clearly attributed.
    let title = null;
    if (multiTrack) {
      const colon = segments[0].indexOf(":");
      if (colon > 0 && colon <= 42) {
        title = segments[0].slice(0, colon).trim();
        segments[0] = segments[0].slice(colon + 1).trim();
      } else {
        title = `Line ${trackIdx + 1}`;
      }
    }

    const idPrefix = `T${trackIdx + 1}N`;
    const indent = multiTrack ? "    " : "  ";
    const chain = [];
    segments.forEach((seg, segIdx) => {
      chain.push(
        `${indent}${idPrefix}${segIdx + 1}["${escapeMermaidLabel(conciseLabel(seg))}"]`,
      );
    });
    for (let i = 0; i < segments.length - 1; i++) {
      chain.push(`${indent}${idPrefix}${i + 1} --> ${idPrefix}${i + 2}`);
    }

    if (multiTrack) {
      mermaidLines.push(
        `  subgraph G${trackIdx + 1}["${escapeMermaidLabel(title)}"]`,
      );
      mermaidLines.push("    direction TB");
      mermaidLines.push(...chain, "  end");
      steps.push({ label: title, detail: segments.join(" → ") });
    } else {
      mermaidLines.push(...chain);
      segments.forEach((seg) => steps.push({ label: null, detail: seg }));
    }
  });

  // Invisible links keep the contrasting columns laid out side by side (LR).
  if (multiTrack) {
    for (let i = 1; i < tracks.length; i++) {
      mermaidLines.push(`  G${i} ~~~ G${i + 1}`);
    }
  }

  const caption = multiTrack
    ? "How to read this: each labelled column is a separate line of reasoning contrasted in the class — read each column top to bottom. The columns are compared side by side below."
    : "How to read this: each box is one link in the class's core argument; follow the arrows from premise to conclusion. Full wording for every step is listed below.";

  const flowchartBlock = [
    "",
    "#### Argument Map Flowchart",
    "",
    renderFlowchartWithExplanation(mermaidLines.join("\n"), caption, steps),
    "",
  ];

  const newLines = [
    ...lines.slice(0, sectionEnd),
    ...flowchartBlock,
    ...lines.slice(sectionEnd),
  ];
  return newLines.join("\n");
}

/** Hide the `> **Source note:** ...` disclaimer from the rendered page while keeping it in the generated source as an MDX JS-comment (MDX doesn't support raw `<!-- -->` HTML comments). */
function commentOutSourceNote(body) {
  return body.replace(
    /^>\s*\*\*Source note:\*\*.*$/m,
    (line) => `{/* ${line.replace(/^>\s*/, "").replace(/\*\//g, "* /")} */}`,
  );
}

/** Build a "watch on YouTube" link line from `metadata.video_url`, or an empty string if absent. */
function videoLinkLine(metadata) {
  if (!metadata?.video_url) return "";
  return `[\u25b6 Watch on YouTube](${metadata.video_url})\n\n`;
}

async function transformBody(rawBody, metadata) {
  let body = stripLeadingHeading(rawBody);
  body = convertAsciiArrowDiagrams(body);
  body = injectArgumentMapFlowchart(body);
  body = await injectVerses(body);
  body = commentOutSourceNote(body);
  return `${videoLinkLine(metadata)}${body.trim()}`;
}

async function loadMetadata(parentDir) {
  const metadataPath = path.join(parentDir, "metadata.json");
  if (!(await pathExists(metadataPath))) return null;
  try {
    return JSON.parse(await readFile(metadataPath, "utf8"));
  } catch {
    return null;
  }
}

function firstHeading(rawBody) {
  const match = /^#\s+(.+)$/m.exec(rawBody);
  return match ? match[1].trim() : null;
}

async function main() {
  await rm(CONTENT_DIR, { recursive: true, force: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  const groups = (await pathExists(OUTPUTS_DIR))
    ? await findNoteGroups(OUTPUTS_DIR)
    : [];
  const entries = [];

  for (const group of groups) {
    const metadata = await loadMetadata(group.parentDir);
    for (const file of group.files) {
      const rawBody = await readFile(path.join(group.notesDir, file), "utf8");
      const baseName = file.replace(/\.md$/, "");
      const slug = slugify(baseName.replace(/-notes$/, ""));
      const title = metadata?.title ?? firstHeading(rawBody) ?? baseName;
      const description = metadata?.duration
        ? `Bhakti Shastri lecture notes (${metadata.duration}).`
        : "Bhakti Shastri lecture notes.";

      const frontmatter = [
        "---",
        `title: ${yamlString(title)}`,
        `description: ${yamlString(description)}`,
        "---",
        "",
      ].join("\n");

      const content = `${frontmatter}${await transformBody(rawBody, metadata)}\n`;
      await writeFile(path.join(CONTENT_DIR, `${slug}.mdx`), content, "utf8");

      entries.push({ slug, title, day: extractDayNumber(title) });
    }
  }

  entries.sort((a, b) => {
    if (a.day != null && b.day != null) return a.day - b.day;
    if (a.day != null) return -1;
    if (b.day != null) return 1;
    return a.title.localeCompare(b.title);
  });

  const indexBody = [
    "---",
    `title: ${yamlString("Bhakti Shastri Notes")}`,
    `description: ${yamlString("All lecture notes, generated from the outputs/ transcripts.")}`,
    "---",
    "",
    entries.length === 0
      ? "No notes have been generated yet. Run the note generator, then re-run `npm run sync-notes`."
      : "Browse every lecture below, or use the search bar in the sidebar to jump to a topic.",
    "",
    "<Cards>",
    ...entries.map(
      (e) => `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
    ),
    "</Cards>",
    "",
  ].join("\n");
  await writeFile(path.join(CONTENT_DIR, "index.mdx"), indexBody, "utf8");

  const meta = {
    title: "Bhakti Shastri Notes",
    pages: ["index", ...entries.map((e) => e.slug)],
  };
  await writeFile(
    path.join(CONTENT_DIR, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `Synced ${entries.length} note(s) into ${path.relative(WEB_ROOT, CONTENT_DIR)}/`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

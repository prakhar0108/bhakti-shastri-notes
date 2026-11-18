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
// Standalone sessions outside the Bhakti Shastri course (e.g. Know Yourself).
const OTHER_NOTES_DIR = path.join(REPO_ROOT, "other-notes");
const OTHER_SESSIONS_SLUG = "other-sessions";
// Bhakti Shastri lectures by HG Chaitanya Charan Das: a separate, private section whose
// notes embed vedabase.io pages instead of storing verse text.
const CCD_SLUG = "chaitanya-charan-das";
const CCD_DIR = path.join(OUTPUTS_DIR, CCD_SLUG);
const CCD_TEACHER = "HG Chaitanya Charan Das";

// The teacher for the whole Bhakti Shastri course; credited on every generated page.
const TEACHER_NAME = "HG Adishyam Prabhuji";

// Exam Q&A sets: outputs/exam-prep/<unit>/qa/*.md (+ .hi.md), with a unit-level metadata.json.
const EXAM_PREP_DIR = path.join(OUTPUTS_DIR, "exam-prep");
const EXAM_PREP_SLUG = "exam-prep";
const EXAM_PREP_STRINGS = {
  en: {
    title: "Exam Preparation",
    description: "Assessment questions with exam-ready answers.",
    intro:
      "Questions from the course's self-study assessments, answered from the class notes and Bhagavad-gītā As It Is. Open a question to read its answer, or use **Expand all answers** to revise a whole chapter at once.",
    credit: `Answers drawn from ${TEACHER_NAME}'s class notes and Bhagavad-gītā As It Is`,
    switchLabel: "हिन्दी में पढ़ें",
    back: "Back to Exam Preparation",
  },
  hi: {
    title: "परीक्षा तैयारी",
    description: "मूल्यांकन प्रश्न और परीक्षा हेतु उत्तर।",
    intro:
      "पाठ्यक्रम के स्व-अध्ययन मूल्यांकन के प्रश्न, कक्षा-टिप्पणियों और भगवद्गीता यथारूप के आधार पर उत्तर सहित। उत्तर पढ़ने के लिए प्रश्न खोलें, या पूरे अध्याय की पुनरावृत्ति के लिए **सभी उत्तर खोलें** का उपयोग करें।",
    credit: `${TEACHER_NAME} की कक्षा-टिप्पणियों और भगवद्गीता यथारूप पर आधारित उत्तर`,
    switchLabel: "Read in English",
    back: "परीक्षा तैयारी पर वापस",
  },
};

const verseCache = new Map();

// Per-language strings for lecture pages. A note is Hindi when its filename ends in
// `.hi.md`; its page slug is the English slug plus `-hi`, so English URLs never move.
// `switchLabel` labels the link *to the other* language, as shown on this language's page.
const LANGS = {
  en: {
    classBy: (teacher) => `Class by ${teacher}`,
    description: (duration) =>
      duration
        ? `Bhakti Shastri lecture notes (${duration}).`
        : "Bhakti Shastri lecture notes.",
    flowchartHeading: "#### Argument Map Flowchart",
    switchLabel: "हिन्दी में पढ़ें",
    tabTitle: "English",
    dir: "en",
  },
  hi: {
    classBy: (teacher) => `कक्षा — ${teacher}`,
    description: (duration) =>
      duration
        ? `भक्ति शास्त्र कक्षा टिप्पणी (${duration})।`
        : "भक्ति शास्त्र कक्षा टिप्पणी।",
    flowchartHeading: "#### तर्क-क्रम रेखाचित्र",
    switchLabel: "Read in English",
    tabTitle: "हिन्दी",
    dir: "hi",
  },
};

// Sidebar label for a lecture: the first two segments of its title, e.g.
// "Day 36 | BG 3.36 - 3.40 | Karma - yoga | ..." -> "Day 36 · BG 3.36 - 3.40".
function shortLectureLabel(title) {
  return title
    .split("|")
    .slice(0, 2)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

/** A `meta.json` `pages` entry linking out to a lecture that lives at the content root. */
function lectureLink(entry) {
  return `[${shortLectureLabel(entry.title)}](/docs/${entry.slug})`;
}

// Canonical Bhagavad-gītā chapter titles, verified against vedabase.io/en/library/bg/.
const BG_CHAPTERS = [
  "Observing the Armies on the Battlefield of Kurukṣetra",
  "Contents of the Gītā Summarized",
  "Karma-yoga",
  "Transcendental Knowledge",
  "Karma-yoga – Action in Kṛṣṇa Consciousness",
  "Dhyāna-yoga",
  "Knowledge of the Absolute",
  "Attaining the Supreme",
  "The Most Confidential Knowledge",
  "The Opulence of the Absolute",
  "The Universal Form",
  "Devotional Service",
  "Nature, the Enjoyer and Consciousness",
  "The Three Modes of Material Nature",
  "The Yoga of the Supreme Person",
  "The Divine and Demoniac Natures",
  "The Divisions of Faith",
  "Conclusion – The Perfection of Renunciation",
];
// The four books of the course, for the homepage library grid.
const BOOKS = [
  {
    slug: "bhagavad-gita",
    title: "Bhagavad-gītā As It Is",
    cover: "/covers/bhagavad-gita.avif",
    alt: "Cover of Bhagavad-gītā As It Is",
    status: "Notes available",
    available: true,
  },
  {
    slug: "nectar-of-instruction",
    title: "The Nectar of Instruction",
    cover: "/covers/nectar-of-instruction.avif",
    alt: "Cover of The Nectar of Instruction",
    status: "Coming soon",
    available: false,
  },
  {
    slug: "nectar-of-devotion",
    title: "The Nectar of Devotion",
    cover: "/covers/nectar-of-devotion.avif",
    alt: "Cover of The Nectar of Devotion",
    status: "Coming soon",
    available: false,
  },
  {
    slug: "isopanishad",
    title: "Śrī Īśopaniṣad",
    cover: "/covers/isopanishad.avif",
    alt: "Cover of Śrī Īśopaniṣad",
    status: "Coming soon",
    available: false,
  },
];

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

// Labels for `<!-- vedabase:<book>/<part> -->` markers, keyed by vedabase.io book code.
const VEDABASE_BOOKS = {
  iso: { title: "Śrī Īśopaniṣad", unit: "Mantra" },
  noi: { title: "The Nectar of Instruction", unit: "Text" },
  nod: { title: "The Nectar of Devotion", unit: "Chapter" },
};

/** Label for a vedabase book page, e.g. ("iso", "3") -> "Śrī Īśopaniṣad Mantra 3". */
function vedabasePartLabel(book, part) {
  const { title, unit } = VEDABASE_BOOKS[book];
  if (/^\d+$/.test(part)) return `${title} ${unit} ${Number(part)}`;
  return `${title} ${part.charAt(0).toUpperCase()}${part.slice(1)}`;
}

/**
 * Replace vedabase markers with an embedded vedabase.io page (no stored verse text):
 * `<!-- vedabase:2.13 -->` for a Gītā verse, `<!-- vedabase:iso/3 -->`, `<!-- vedabase:noi/preface -->`,
 * `<!-- vedabase:nod/12 -->` for Īśopaniṣad mantras, Nectar of Instruction texts and Nectar of Devotion chapters.
 */
function injectVedabaseEmbeds(body) {
  return body
    .replace(
      /<!--\s*vedabase:(\d+)\.(\d+)\s*-->/g,
      (_, chapter, verse) =>
        `<VedabaseVerse label="Bhagavad-gītā ${chapter}.${verse}" href="https://vedabase.io/en/library/bg/${chapter}/${verse}/" />`,
    )
    .replace(
      /<!--\s*vedabase:(iso|noi|nod)\/([a-z0-9-]+)\s*-->/g,
      (_, book, part) =>
        `<VedabaseVerse label={${yamlString(vedabasePartLabel(book, part))}} href="https://vedabase.io/en/library/${book}/${part}/" />`,
    );
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
    if (["notes", "transcripts", "work", "shared", CCD_SLUG].includes(entry.name))
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
  const match = /(?:day|दिन)\s+(\d+)/i.exec(title ?? "");
  return match ? Number(match[1]) : null;
}

/** Read the Bhagavad Gita chapter number out of a lecture title, e.g. "BG 2.1 - 2.4" -> 2. */
function extractChapterNumber(title) {
  const match = /\bbg\s*[-–]?\s*(\d+)\.\d+/i.exec(title ?? "");
  return match ? Number(match[1]) : null;
}

/** Human-readable list of available chapters, e.g. "Chapters 2 and 3 available". */
function chapterStatus(chapters) {
  if (chapters.length === 0) return "Coming soon";
  if (chapters.length === 1) return `Chapter ${chapters[0]} notes available`;
  const list = `${chapters.slice(0, -1).join(", ")} and ${chapters.at(-1)}`;
  return `Chapters ${list} notes available`;
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

/**
 * Render a Mermaid node/edge label using the "markdown string" syntax (backtick-quoted), which
 * makes Mermaid auto-wrap long sentences to the node's `wrappingWidth` instead of sizing the box
 * to fit the whole sentence on one line (which then overflows/clips in a narrow content column).
 */
function mermaidLabel(text) {
  return `["\`${escapeMermaidLabel(text)}\`"]`;
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

/** Wrap a Mermaid flowchart body in a fenced code block. */
function renderFlowchart(mermaidBody) {
  return ["```mermaid", mermaidBody, "```"].join("\n");
}

/** Build a single vertical arrow-chain flowchart from a list of node sentences. */
function buildArrowChainDiagram(nodes) {
  const mermaidLines = ["flowchart TD"];
  nodes.forEach((node, i) => {
    const verseMatch =
      /^(BG\s*\d+\.\d+(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*[:\-–]\s*(.*)$/i.exec(
        node.trim(),
      );
    const label = verseMatch
      ? `${verseMatch[1]}: ${conciseLabel(verseMatch[2])}`
      : conciseLabel(node);
    mermaidLines.push(`  N${i + 1}${mermaidLabel(label)}`);
  });
  for (let i = 0; i < nodes.length - 1; i++) {
    mermaidLines.push(`  N${i + 1} --> N${i + 2}`);
  }
  return renderFlowchart(mermaidLines.join("\n"));
}

/**
 * Turn plain (unlabelled) ASCII "│ / ▼" arrow-chain code fences into Mermaid flowcharts.
 *
 * Walks the body line-by-line and tracks fence open/close explicitly instead of using a single
 * regex over the whole body — a regex matching bare "```\n...\n```" can't tell a language-tagged
 * fence's closing "```" apart from some later fence's opening "```", so a hand-authored
 * ```mermaid block earlier in the note would desync the pairing and swallow a real ASCII diagram
 * fence further down without converting it. Only bare (no language) fences are conversion
 * candidates; any fence with a language tag (```mermaid, ```mdx, ...) is left untouched.
 */
function convertAsciiArrowDiagrams(body) {
  const lines = body.split("\n");
  const output = [];
  let i = 0;
  while (i < lines.length) {
    const fenceMatch = /^```(\S*)\s*$/.exec(lines[i].trim());
    if (!fenceMatch) {
      output.push(lines[i]);
      i++;
      continue;
    }

    const lang = fenceMatch[1];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "```") j++;
    const contentLines = lines.slice(i + 1, j);
    const closeLine = j < lines.length ? lines[j] : "```";

    if (lang === "") {
      const nodes = [];
      let buffer = [];
      for (const rawLine of contentLines) {
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

      if (/[│▼]/.test(contentLines.join("\n")) && nodes.length >= 2) {
        output.push(buildArrowChainDiagram(nodes));
        i = j + 1;
        continue;
      }
    }

    output.push(lines[i], ...contentLines, closeLine);
    i = j + 1;
  }
  return output.join("\n");
}

/** Find the "Class Snapshot / Argument Map" section and append a Mermaid flowchart of its argument chain. */
function injectArgumentMapFlowchart(body, flowchartHeading) {
  const lines = body.split("\n");
  const headingRe =
    /^(#{2,4})\s+.*(class snapshot|argument|कक्षा सार|तर्क-क्रम)/i;

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
    const boldMatch =
      /^\s*-?\s*\*\*([^*]*(?:argument|तर्क-क्रम)[^*]*)\*\*:?\s*(.*)$/i.exec(
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
        `${indent}${idPrefix}${segIdx + 1}${mermaidLabel(conciseLabel(seg))}`,
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
    } else {
      mermaidLines.push(...chain);
    }
  });

  // Invisible links keep the contrasting columns laid out side by side (LR).
  if (multiTrack) {
    for (let i = 1; i < tracks.length; i++) {
      mermaidLines.push(`  G${i} ~~~ G${i + 1}`);
    }
  }

  const flowchartBlock = [
    "",
    flowchartHeading,
    "",
    renderFlowchart(mermaidLines.join("\n")),
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

/** Build the compact "watch + language switch + teacher credit" meta row for a lecture. */
function lectureMetaLine(metadata, strings, counterpartSlug) {
  const teacher = metadata?.speaker ?? TEACHER_NAME;
  const href = metadata?.video_url ? ` href="${metadata.video_url}"` : "";
  const translation = counterpartSlug
    ? ` translationHref="/docs/${counterpartSlug}" translationLabel={${yamlString(strings.switchLabel)}}`
    : "";
  return `<LectureMeta${href}${translation}>${strings.classBy(teacher)}</LectureMeta>\n\n`;
}

/** Drop the repository-only `## Transcript Verification Flags` section from published pages. */
function stripVerificationFlags(body) {
  return body.replace(
    /^##[ \t]+Transcript Verification Flags[ \t]*\r?\n[\s\S]*?(?=^#{1,2}[ \t]+|(?![\s\S]))/gm,
    "",
  );
}

async function transformBody(rawBody, metadata, strings, counterpartSlug) {
  let body = stripVerificationFlags(stripLeadingHeading(rawBody));
  body = convertAsciiArrowDiagrams(body);
  body = injectArgumentMapFlowchart(body, strings.flowchartHeading);
  body = await injectVerses(body);
  body = injectVedabaseEmbeds(body);
  body = commentOutSourceNote(body);
  return `${lectureMetaLine(metadata, strings, counterpartSlug)}${body.trim()}`;
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

/** Write a generated `.mdx` doc with YAML frontmatter, creating parent folders as needed. */
async function writeMdx(filePath, { title, description }, bodyLines) {
  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    "---",
    "",
  ].join("\n");
  const body = (
    Array.isArray(bodyLines) ? bodyLines.join("\n") : bodyLines
  ).trim();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${frontmatter}${body}\n`, "utf8");
}

/** Write a folder's `meta.json` (sidebar title + ordered `pages`), creating the folder if needed. */
async function writeMetaFile(dir, meta) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Build one language's navigation tree: the book library, the Bhagavad Gita chapter
 * list, a per-chapter lecture index, and "coming soon" pages for the other three books.
 * Everything is written under `content/docs/<lang>/`, whose `meta.json` carries
 * `root: "language"` so Fumadocs renders the languages as sidebar tabs.
 * Lecture pages themselves stay at the content root so their `/docs/<slug>` URLs never
 * change; the sidebar reaches them through `[label](url)` entries in `meta.json`.
 */
async function writeBookLibrary(
  baseDir,
  urlPrefix,
  entriesByChapter,
  introEntries = [],
  otherEntries = [],
  examEntries = [],
  hasCcd = false,
) {
  const availableChapters = [...entriesByChapter.keys()].sort((a, b) => a - b);
  const books = BOOKS.map((book) =>
    book.slug === "bhagavad-gita"
      ? { ...book, status: chapterStatus(availableChapters) }
      : book,
  );

  await writeMdx(
    path.join(baseDir, "index.mdx"),
    {
      title: "Bhakti Shastri Notes",
      description: "Bhakti Shastri course notes, organized by book.",
    },
    [
      "Teacher- HG Adishyam Prabhuji",
      "",
      "Browse the course by book, or use the search bar in the sidebar to jump to a topic.",
      "",
      "<BookGrid>",
      ...books.map(
        (b) =>
          `  <BookCard href="${urlPrefix}/${b.slug}" title={${yamlString(b.title)}} cover="${b.cover}" alt={${yamlString(b.alt)}} status={${yamlString(b.status)}} available={${b.available}} />`,
      ),
      "</BookGrid>",
      ...(examEntries.length > 0 || hasCcd
        ? [
            "",
            "<Cards>",
            ...(examEntries.length > 0
              ? [
                  `  <Card title="${EXAM_PREP_STRINGS.en.title}" description="${EXAM_PREP_STRINGS.en.description}" href="${urlPrefix}/${EXAM_PREP_SLUG}" />`,
                ]
              : []),
            ...(hasCcd
              ? [
                  `  <Card title="${CCD_TEACHER}" description="Bhakti Shastri lecture notes by ${CCD_TEACHER}" href="${urlPrefix}/${CCD_SLUG}" />`,
                ]
              : []),
            "</Cards>",
          ]
        : []),
    ],
  );
  await writeMetaFile(baseDir, {
    root: "language",
    title: LANGS.en.tabTitle,
    // "index" must be a listed child, not `pagesIndex`: the tab switcher is only rendered
    // for pages Fumadocs can find in `children`, which includes this folder's own landing page.
    pages: [
      "index",
      ...books.map((b) => b.slug),
      ...(examEntries.length > 0 ? [EXAM_PREP_SLUG] : []),
      ...(hasCcd ? [CCD_SLUG] : []),
      ...(otherEntries.length > 0 ? [OTHER_SESSIONS_SLUG] : []),
    ],
  });

  if (examEntries.length > 0) {
    await writeExamPrepIndex(baseDir, "en", examEntries);
  }

  if (otherEntries.length > 0) {
    const otherDir = path.join(baseDir, OTHER_SESSIONS_SLUG);
    await writeMdx(
      path.join(otherDir, "index.mdx"),
      {
        title: "Other Sessions",
        description: "Session notes outside the Bhakti Shastri course.",
      },
      [
        "Notes for standalone sessions that are not part of the Bhakti Shastri course.",
        "",
        "<Cards>",
        ...otherEntries.map(
          (e) =>
            `  <Card title={${yamlString(e.title)}} description={${yamlString(e.speaker ?? "")}} href="/docs/${e.slug}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title="Back to Book Library" href="${urlPrefix}" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(otherDir, {
      title: "Other Sessions",
      icon: "private",
      pages: [
        "index",
        ...otherEntries.map((e) => `[${e.title}](/docs/${e.slug})`),
      ],
    });
  }

  // Bhagavad Gita — all 18 canonical chapters; only chapters with notes link anywhere.
  const bgDir = path.join(baseDir, "bhagavad-gita");
  await writeMdx(
    path.join(bgDir, "index.mdx"),
    {
      title: "Bhagavad-gītā As It Is",
      description:
        "Bhagavad Gita chapters covered in the Bhakti Shastri course.",
    },
    [
      '<BookCover src="/covers/bhagavad-gita.avif" alt="Cover of Bhagavad-gītā As It Is" />',
      "",
      `Teacher - ${TEACHER_NAME}`,
      "",
      `Select a chapter below. ${chapterStatus(availableChapters)}; the rest are coming soon.`,
      "",
      "<Cards>",
      ...(introEntries.length > 0
        ? [
            `  <Card title="Introduction" description="${introEntries.length} lecture notes" href="${urlPrefix}/bhagavad-gita/introduction" />`,
          ]
        : []),
      ...BG_CHAPTERS.map((title, i) => {
        const num = i + 1;
        const cardTitle = yamlString(`Chapter ${num}: ${title}`);
        return availableChapters.includes(num)
          ? `  <Card title={${cardTitle}} description="${entriesByChapter.get(num).length} lecture notes" href="${urlPrefix}/bhagavad-gita/chapter-${num}" />`
          : `  <Card title={${cardTitle}} description="Coming soon" />`;
      }),
      "</Cards>",
      "",
      "<Cards>",
      `  <Card title="Back to Book Library" href="${urlPrefix}" />`,
      "</Cards>",
    ],
  );
  await writeMetaFile(bgDir, {
    title: "Bhagavad-gītā As It Is",
    pages: [
      "index",
      ...(introEntries.length > 0 ? ["introduction"] : []),
      ...availableChapters.map((num) => `chapter-${num}`),
    ],
  });

  // Lectures that precede Chapter One and so carry no "BG X.X" in their title.
  if (introEntries.length > 0) {
    const introDir = path.join(bgDir, "introduction");
    await writeMdx(
      path.join(introDir, "index.mdx"),
      {
        title: "Bhagavad Gita: Introduction",
        description:
          "Introductory lectures on the Bhagavad Gita, in day order.",
      },
      [
        `Teacher - ${TEACHER_NAME}`,
        "",
        "Lectures introducing the Bhagavad Gita before Chapter One begins, in the order they were taught.",
        "",
        "<Cards>",
        ...introEntries.map(
          (e) =>
            `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title="Back to Bhagavad Gita chapters" href="${urlPrefix}/bhagavad-gita" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(introDir, {
      title: "Introduction",
      pages: ["index", ...introEntries.map(lectureLink)],
    });
  }

  // One index page per chapter that has notes, listing its lectures in day order.
  for (const num of availableChapters) {
    const chapterName = BG_CHAPTERS[num - 1];
    const chapterDir = path.join(bgDir, `chapter-${num}`);
    const chapterEntries = entriesByChapter.get(num);
    await writeMdx(
      path.join(chapterDir, "index.mdx"),
      {
        title: `Bhagavad Gita: Chapter ${num} – ${chapterName}`,
        description: `Lecture notes for Bhagavad Gita Chapter ${num}, in day order.`,
      },
      [
        `Teacher - ${TEACHER_NAME}`,
        "",
        `Lectures covering Bhagavad Gita Chapter ${num}, in the order they were taught.`,
        "",
        "<Cards>",
        ...chapterEntries.map(
          (e) =>
            `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title="Back to Bhagavad Gita chapters" href="${urlPrefix}/bhagavad-gita" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(chapterDir, {
      title: `Chapter ${num} – ${chapterName}`,
      pages: ["index", ...chapterEntries.map(lectureLink)],
    });
  }

  // Nectar of Instruction, Nectar of Devotion, Śrī Īśopaniṣad — book-specific "coming soon" pages.
  const comingSoonBooks = [
    {
      slug: "nectar-of-instruction",
      title: "The Nectar of Instruction",
      cover: "/covers/nectar-of-instruction.avif",
      alt: "Cover of The Nectar of Instruction",
      description:
        "Notes for the eleven texts of Śrī Upadeśāmṛta — coming soon.",
      body: "Notes for the eleven texts of *Śrī Upadeśāmṛta* (The Nectar of Instruction) will appear here as they are prepared.",
    },
    {
      slug: "nectar-of-devotion",
      title: "The Nectar of Devotion",
      cover: "/covers/nectar-of-devotion.avif",
      alt: "Cover of The Nectar of Devotion",
      description:
        "Notes for the chapters of The Nectar of Devotion — coming soon.",
      body: "Notes for the chapters of *The Nectar of Devotion* (a summary study of Śrīla Rūpa Gosvāmī's Bhakti-rasāmṛta-sindhu) will appear here as they are prepared.",
    },
    {
      slug: "isopanishad",
      title: "Śrī Īśopaniṣad",
      cover: "/covers/isopanishad.avif",
      alt: "Cover of Śrī Īśopaniṣad",
      description:
        "Notes for the invocation and eighteen mantras of Śrī Īśopaniṣad — coming soon.",
      body: "Notes for the invocation and eighteen mantras of *Śrī Īśopaniṣad* will appear here as they are prepared.",
    },
  ];

  for (const book of comingSoonBooks) {
    const dir = path.join(baseDir, book.slug);
    await writeMdx(
      path.join(dir, "index.mdx"),
      { title: book.title, description: book.description },
      [
        `<BookCover src="${book.cover}" alt={${yamlString(book.alt)}} />`,
        "",
        `Teacher - ${TEACHER_NAME}`,
        "",
        `**Coming soon.** ${book.body}`,
        "",
        "<Cards>",
        `  <Card title="Back to Book Library" href="${urlPrefix}" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(dir, { title: book.title, pages: ["index"] });
  }
}

// Hindi chapter names, taken from the Hindi lecture notes themselves. Chapters with no
// Hindi notes are omitted rather than given an invented title — vedabase.io has no Hindi
// Bhagavad-gita edition to verify them against.
const BG_CHAPTERS_HI = {
  1: "अर्जुन विषाद योग",
  2: "सांख्य-योग",
  3: "कर्म-योग",
  4: "दिव्य ज्ञान",
};

/** Build the Hindi navigation tree, listing only the chapters that actually have Hindi notes. */
async function writeHindiLibrary(
  baseDir,
  urlPrefix,
  entriesByChapter,
  introEntries = [],
  examEntries = [],
) {
  const availableChapters = [...entriesByChapter.keys()].sort((a, b) => a - b);
  const chapterLabel = (num) =>
    BG_CHAPTERS_HI[num]
      ? `अध्याय ${num} – ${BG_CHAPTERS_HI[num]}`
      : `अध्याय ${num}`;

  await writeMdx(
    path.join(baseDir, "index.mdx"),
    {
      title: "भक्ति शास्त्र टिप्पणी",
      description: "भक्ति शास्त्र पाठ्यक्रम की हिन्दी टिप्पणियाँ।",
    },
    [
      `शिक्षक - ${TEACHER_NAME}`,
      "",
      "हिन्दी में उपलब्ध सामग्री नीचे दी गई है। शेष अध्याय और पुस्तकें क्रमशः जोड़ी जाएंगी; पूर्ण पाठ्यक्रम अभी अंग्रेज़ी में ही उपलब्ध है।",
      "",
      "<Cards>",
      '  <Card title="भगवद्गीता यथारूप" href="' +
        urlPrefix +
        '/bhagavad-gita" />',
      ...(examEntries.length > 0
        ? [
            `  <Card title="${EXAM_PREP_STRINGS.hi.title}" description="${EXAM_PREP_STRINGS.hi.description}" href="${urlPrefix}/${EXAM_PREP_SLUG}" />`,
          ]
        : []),
      "</Cards>",
    ],
  );
  await writeMetaFile(baseDir, {
    root: "language",
    title: LANGS.hi.tabTitle,
    pages: [
      "index",
      "bhagavad-gita",
      ...(examEntries.length > 0 ? [EXAM_PREP_SLUG] : []),
    ],
  });

  if (examEntries.length > 0) {
    await writeExamPrepIndex(baseDir, "hi", examEntries);
  }

  const bgDir = path.join(baseDir, "bhagavad-gita");
  await writeMdx(
    path.join(bgDir, "index.mdx"),
    {
      title: "भगवद्गीता यथारूप",
      description:
        "भक्ति शास्त्र पाठ्यक्रम के वे अध्याय जिनकी टिप्पणी हिन्दी में उपलब्ध है।",
    },
    [
      '<BookCover src="/covers/bhagavad-gita.avif" alt="भगवद्गीता यथारूप का आवरण" />',
      "",
      `शिक्षक - ${TEACHER_NAME}`,
      "",
      "नीचे वे अध्याय दिए गए हैं जिनकी हिन्दी टिप्पणी तैयार है।",
      "",
      "<Cards>",
      ...(introEntries.length > 0
        ? [
            `  <Card title="परिचय" description="${introEntries.length} कक्षा टिप्पणी" href="${urlPrefix}/bhagavad-gita/introduction" />`,
          ]
        : []),
      ...availableChapters.map(
        (num) =>
          `  <Card title={${yamlString(chapterLabel(num))}} description="${entriesByChapter.get(num).length} कक्षा टिप्पणी" href="${urlPrefix}/bhagavad-gita/chapter-${num}" />`,
      ),
      "</Cards>",
    ],
  );
  await writeMetaFile(bgDir, {
    title: "भगवद्गीता यथारूप",
    pages: [
      "index",
      ...(introEntries.length > 0 ? ["introduction"] : []),
      ...availableChapters.map((num) => `chapter-${num}`),
    ],
  });

  if (introEntries.length > 0) {
    const introDir = path.join(bgDir, "introduction");
    await writeMdx(
      path.join(introDir, "index.mdx"),
      {
        title: "भगवद्गीता: परिचय",
        description: "भगवद्गीता की परिचयात्मक कक्षाएँ, दिन क्रम में।",
      },
      [
        `शिक्षक - ${TEACHER_NAME}`,
        "",
        "प्रथम अध्याय आरंभ होने से पहले की परिचयात्मक कक्षाएँ, जिस क्रम में पढ़ाई गईं।",
        "",
        "<Cards>",
        ...introEntries.map(
          (e) =>
            `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title="भगवद्गीता अध्यायों पर वापस" href="${urlPrefix}/bhagavad-gita" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(introDir, {
      title: "परिचय",
      pages: ["index", ...introEntries.map(lectureLink)],
    });
  }

  for (const num of availableChapters) {
    const chapterDir = path.join(bgDir, `chapter-${num}`);
    const chapterEntries = entriesByChapter.get(num);
    await writeMdx(
      path.join(chapterDir, "index.mdx"),
      {
        title: `भगवद्गीता: ${chapterLabel(num)}`,
        description: `भगवद्गीता अध्याय ${num} की कक्षाएँ, दिन क्रम में।`,
      },
      [
        `शिक्षक - ${TEACHER_NAME}`,
        "",
        `भगवद्गीता अध्याय ${num} की वे कक्षाएँ जिनकी हिन्दी टिप्पणी उपलब्ध है, जिस क्रम में पढ़ाई गईं।`,
        "",
        "<Cards>",
        ...chapterEntries.map(
          (e) =>
            `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title="भगवद्गीता अध्यायों पर वापस" href="${urlPrefix}/bhagavad-gita" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(chapterDir, {
      title: chapterLabel(num),
      pages: ["index", ...chapterEntries.map(lectureLink)],
    });
  }
}

/** Write every exam Q&A page to the content root and return the entries per language. */
async function syncExamPrep() {
  const entries = { en: [], hi: [] };
  if (!(await pathExists(EXAM_PREP_DIR))) return entries;

  const units = (await readdir(EXAM_PREP_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const unit of units) {
    const unitDir = path.join(EXAM_PREP_DIR, unit);
    const qaDir = path.join(unitDir, "qa");
    if (!(await pathExists(qaDir))) continue;
    const metadata = await loadMetadata(unitDir);
    const files = (await readdir(qaDir))
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const lang = file.endsWith(".hi.md") ? "hi" : "en";
      const strings = EXAM_PREP_STRINGS[lang];
      const baseName = file.replace(/(\.hi)?\.md$/, "").replace(/-qa$/, "");
      const baseSlug = slugify(`${EXAM_PREP_SLUG}-${unit}-${baseName}`);
      const slug = lang === "hi" ? `${baseSlug}-hi` : baseSlug;
      const counterpartSlug =
        lang === "hi"
          ? baseSlug
          : files.includes(file.replace(/\.md$/, ".hi.md"))
            ? `${baseSlug}-hi`
            : null;
      const rawBody = await readFile(path.join(qaDir, file), "utf8");
      const title = firstHeading(rawBody) ?? baseName;
      const unitTitle =
        (lang === "hi" ? metadata?.title_hi : metadata?.title) ?? unit;

      let body = stripVerificationFlags(stripLeadingHeading(rawBody));
      body = commentOutSourceNote(await injectVerses(body));
      const translation = counterpartSlug
        ? ` translationHref="/docs/${counterpartSlug}" translationLabel={${yamlString(strings.switchLabel)}}`
        : "";
      await writeMdx(
        path.join(CONTENT_DIR, `${slug}.mdx`),
        { title, description: unitTitle },
        `<LectureMeta${translation}>${strings.credit}</LectureMeta>\n\n${body.trim()}`,
      );
      entries[lang].push({ slug, title, unitTitle });
    }
  }
  return entries;
}

/** The exam-prep landing page and sidebar folder for one language tab. */
async function writeExamPrepIndex(baseDir, lang, entries) {
  const strings = EXAM_PREP_STRINGS[lang];
  const dir = path.join(baseDir, EXAM_PREP_SLUG);
  const units = [...new Set(entries.map((e) => e.unitTitle))];

  await writeMdx(
    path.join(dir, "index.mdx"),
    { title: strings.title, description: strings.description },
    [
      strings.intro,
      "",
      ...units.flatMap((unitTitle) => [
        `## ${unitTitle}`,
        "",
        "<Cards>",
        ...entries
          .filter((e) => e.unitTitle === unitTitle)
          .map(
            (e) =>
              `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`,
          ),
        "</Cards>",
        "",
      ]),
    ],
  );
  await writeMetaFile(dir, {
    title: strings.title,
    // Resolved in src/lib/source.ts to a marker that CSS uses to hide the folder while locked.
    icon: "private",
    pages: [
      "index",
      ...units.flatMap((unitTitle) => [
        `---${unitTitle}---`,
        ...entries
          .filter((e) => e.unitTitle === unitTitle)
          .map((e) => `[${e.title}](/docs/${e.slug})`),
      ]),
    ],
  });
}

/** The `/docs` landing page, which sits outside both language tabs. */
async function writeRootLanding(
  availableChapters,
  hasOtherSessions = false,
  hasExamPrep = false,
  hasCcd = false,
) {
  const books = BOOKS.map((book) =>
    book.slug === "bhagavad-gita"
      ? { ...book, status: chapterStatus(availableChapters) }
      : book,
  );

  await writeMdx(
    path.join(CONTENT_DIR, "index.mdx"),
    {
      title: "Bhakti Shastri Notes",
      description: "Bhakti Shastri course notes, organized by book.",
    },
    [
      "Teacher- HG Adishyam Prabhuji",
      "",
      "Browse the course by book, or use the search bar in the sidebar to jump to a topic.",
      "",
      "<BookGrid>",
      ...books.map(
        (b) =>
          `  <BookCard href="/docs/en/${b.slug}" title={${yamlString(b.title)}} cover="${b.cover}" alt={${yamlString(b.alt)}} status={${yamlString(b.status)}} available={${b.available}} />`,
      ),
      "</BookGrid>",
      "",
      "<Cards>",
      '  <Card title="हिन्दी टिप्पणी" description="Notes available in Hindi" href="/docs/hi" />',
      ...(hasExamPrep
        ? [
            `  <Card title="${EXAM_PREP_STRINGS.en.title}" description="${EXAM_PREP_STRINGS.en.description}" href="/docs/en/${EXAM_PREP_SLUG}" />`,
          ]
        : []),
      ...(hasCcd
        ? [
            `  <Card title="${CCD_TEACHER}" description="Bhakti Shastri lecture notes by ${CCD_TEACHER}" href="/docs/en/${CCD_SLUG}" />`,
          ]
        : []),
      ...(hasOtherSessions
        ? [
            `  <Card title="Other Sessions" description="Standalone session notes outside the course" href="/docs/en/${OTHER_SESSIONS_SLUG}" />`,
          ]
        : []),
      "</Cards>",
    ],
  );
  await writeMetaFile(CONTENT_DIR, {
    title: "Bhakti Shastri Notes",
    // "index" is intentionally omitted: its title duplicates the header title,
    // and the page is still reachable at /docs via the header/logo link.
    pages: ["en", "hi"],
  });
}

/** Read the series session number out of a title, e.g. "BS 043 | BG 1.1 - 1.7 | ..." -> 43. */
function extractSessionNumber(title) {
  const match = /\bBS\s+(\d+)/.exec(title ?? "");
  return match ? Number(match[1]) : null;
}

// HG Chaitanya Charan Das's course books, in the order the series teaches them.
const CCD_BOOKS = ["isopanishad", "nectar-of-instruction", "bhagavad-gita", "nectar-of-devotion"];

/** Write a lecture-list page (+ sidebar meta) for one folder of the Chaitanya Charan Das section. */
async function writeCcdLectureList(dir, { title, description, intro, back }, list) {
  await writeMdx(path.join(dir, "index.mdx"), { title, description }, [
    `Teacher - ${CCD_TEACHER}`,
    "",
    intro,
    "",
    "<Cards>",
    ...list.map((e) => `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`),
    "</Cards>",
    "",
    "<Cards>",
    `  <Card title={${yamlString(back.title)}} href="${back.href}" />`,
    "</Cards>",
  ]);
}

/**
 * Sync the HG Chaitanya Charan Das section: outputs/chaitanya-charan-das/<book>/**\/notes/*.md become
 * `/docs/chaitanya-charan-das-<slug>` pages (prefixed so they match the private-path rule), with a
 * private sidebar folder holding one sub-folder per book; the Bhagavad-gītā is further grouped into
 * Introduction and per-chapter lists. Returns the number of pages written.
 */
async function syncChaitanyaCharanDas(baseDir, urlPrefix) {
  const groups = (await pathExists(CCD_DIR)) ? await findNoteGroups(CCD_DIR) : [];
  const entriesByBook = new Map();
  for (const group of groups) {
    const metadata = await loadMetadata(group.parentDir);
    const book = path.relative(CCD_DIR, group.parentDir).split(path.sep)[0];
    for (const file of group.files.filter((f) => !f.endsWith(".hi.md"))) {
      const rawBody = await readFile(path.join(group.notesDir, file), "utf8");
      const baseName = file.replace(/\.md$/, "");
      const slug = slugify(`${CCD_SLUG}-${baseName.replace(/-notes$/, "")}`);
      const title = metadata?.title ?? firstHeading(rawBody) ?? baseName;
      await writeMdx(
        path.join(CONTENT_DIR, `${slug}.mdx`),
        { title, description: LANGS.en.description(metadata?.duration) },
        await transformBody(rawBody, metadata, LANGS.en, null),
      );
      const list = entriesByBook.get(book) ?? [];
      list.push({
        slug,
        title,
        session: extractSessionNumber(title),
        chapter: book === "bhagavad-gita" ? extractChapterNumber(title) : null,
      });
      entriesByBook.set(book, list);
    }
  }
  const total = [...entriesByBook.values()].reduce((n, l) => n + l.length, 0);
  if (total === 0) return 0;

  const dir = path.join(baseDir, CCD_SLUG);
  const sectionUrl = `${urlPrefix}/${CCD_SLUG}`;
  const books = BOOKS.filter((b) => entriesByBook.has(b.slug)).sort(
    (a, b) => CCD_BOOKS.indexOf(a.slug) - CCD_BOOKS.indexOf(b.slug),
  );
  await writeMdx(
    path.join(dir, "index.mdx"),
    {
      title: CCD_TEACHER,
      description: `Bhakti Shastri lecture notes by ${CCD_TEACHER}, organized by book.`,
    },
    [
      `Teacher - ${CCD_TEACHER}`,
      "",
      "Bhakti Shastri lectures, organized by book in the order they were taught. Each verse, text or chapter is shown as its live vedabase.io page.",
      "",
      "<BookGrid>",
      ...books.map(
        (b) =>
          `  <BookCard href="${sectionUrl}/${b.slug}" title={${yamlString(b.title)}} cover="${b.cover}" alt={${yamlString(b.alt)}} status="${entriesByBook.get(b.slug).length} lecture notes" available={true} />`,
      ),
      "</BookGrid>",
      "",
      "<Cards>",
      `  <Card title="Back to Book Library" href="${urlPrefix}" />`,
      "</Cards>",
    ],
  );
  await writeMetaFile(dir, {
    title: CCD_TEACHER,
    icon: "private",
    pages: ["index", ...books.map((b) => b.slug)],
  });

  const backToSection = { title: `Back to ${CCD_TEACHER}`, href: sectionUrl };
  for (const book of books) {
    const entries = entriesByBook
      .get(book.slug)
      .sort((a, b) => (a.session ?? 0) - (b.session ?? 0));
    const bookDir = path.join(dir, book.slug);
    const bookUrl = `${sectionUrl}/${book.slug}`;

    if (book.slug !== "bhagavad-gita") {
      await writeCcdLectureList(
        bookDir,
        {
          title: `${CCD_TEACHER}: ${book.title}`,
          description: `${CCD_TEACHER}'s lecture notes on ${book.title}, in the order they were taught.`,
          intro: `<BookCover src="${book.cover}" alt={${yamlString(book.alt)}} />`,
          back: backToSection,
        },
        entries,
      );
      await writeMetaFile(bookDir, {
        title: book.title,
        pages: ["index", ...entries.map(lectureLink)],
      });
      continue;
    }

    const intro = entries.filter((e) => e.chapter == null);
    const byChapter = new Map();
    for (const e of entries.filter((e) => e.chapter != null)) {
      byChapter.set(e.chapter, [...(byChapter.get(e.chapter) ?? []), e]);
    }
    const chapters = [...byChapter.keys()].sort((a, b) => a - b);
    await writeMdx(
      path.join(bookDir, "index.mdx"),
      {
        title: `${CCD_TEACHER}: ${book.title}`,
        description: `${CCD_TEACHER}'s Bhagavad-gītā lecture notes, by chapter.`,
      },
      [
        `<BookCover src="${book.cover}" alt={${yamlString(book.alt)}} />`,
        "",
        `Teacher - ${CCD_TEACHER}`,
        "",
        "<Cards>",
        ...(intro.length > 0
          ? [
              `  <Card title="Introduction" description="${intro.length} lecture notes" href="${bookUrl}/introduction" />`,
            ]
          : []),
        ...chapters.map(
          (num) =>
            `  <Card title={${yamlString(`Chapter ${num}: ${BG_CHAPTERS[num - 1]}`)}} description="${byChapter.get(num).length} lecture notes" href="${bookUrl}/chapter-${num}" />`,
        ),
        "</Cards>",
        "",
        "<Cards>",
        `  <Card title={${yamlString(backToSection.title)}} href="${backToSection.href}" />`,
        "</Cards>",
      ],
    );
    await writeMetaFile(bookDir, {
      title: book.title,
      pages: [
        "index",
        ...(intro.length > 0 ? ["introduction"] : []),
        ...chapters.map((num) => `chapter-${num}`),
      ],
    });

    const lists = [
      ...(intro.length > 0 ? [["introduction", "Introduction", intro]] : []),
      ...chapters.map((num) => [
        `chapter-${num}`,
        `Chapter ${num} – ${BG_CHAPTERS[num - 1]}`,
        byChapter.get(num),
      ]),
    ];
    for (const [folder, label, list] of lists) {
      await writeCcdLectureList(
        path.join(bookDir, folder),
        {
          title: `${CCD_TEACHER}: Bhagavad-gītā ${label}`,
          description: `${CCD_TEACHER}'s lecture notes — Bhagavad-gītā ${label}.`,
          intro: `Lectures in the order they were taught.`,
          back: { title: "Back to Bhagavad-gītā chapters", href: bookUrl },
        },
        list,
      );
      await writeMetaFile(path.join(bookDir, folder), {
        title: label,
        pages: ["index", ...list.map(lectureLink)],
      });
    }
  }
  return total;
}

async function main() {
  await rm(CONTENT_DIR, { recursive: true, force: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  const groups = (await pathExists(OUTPUTS_DIR))
    ? await findNoteGroups(OUTPUTS_DIR)
    : [];
  const entriesByLang = { en: [], hi: [] };
  let pageCount = 0;

  for (const group of groups) {
    const metadata = await loadMetadata(group.parentDir);
    const hasHindi = group.files.some((file) => file.endsWith(".hi.md"));
    for (const file of group.files) {
      const rawBody = await readFile(path.join(group.notesDir, file), "utf8");
      const lang = file.endsWith(".hi.md") ? "hi" : "en";
      const strings = LANGS[lang];
      const baseName = file.replace(/(\.hi)?\.md$/, "");
      const baseSlug = slugify(baseName.replace(/-notes$/, ""));
      const slug = lang === "hi" ? `${baseSlug}-hi` : baseSlug;
      const counterpartSlug =
        lang === "hi" ? baseSlug : hasHindi ? `${baseSlug}-hi` : null;
      const title =
        (lang === "hi" ? metadata?.title_hi : metadata?.title) ??
        firstHeading(rawBody) ??
        baseName;
      const description = strings.description(metadata?.duration);

      const frontmatter = [
        "---",
        `title: ${yamlString(title)}`,
        `description: ${yamlString(description)}`,
        "---",
        "",
      ].join("\n");

      const content = `${frontmatter}${await transformBody(rawBody, metadata, strings, counterpartSlug)}\n`;
      await writeFile(path.join(CONTENT_DIR, `${slug}.mdx`), content, "utf8");
      pageCount++;

      entriesByLang[lang].push({
        slug,
        title,
        day: extractDayNumber(title),
        chapter: extractChapterNumber(title),
        isIntroduction: path
          .relative(OUTPUTS_DIR, group.parentDir)
          .split(path.sep)
          .includes("introduction"),
      });
    }
  }

  /** Sort a language's lectures by day, then group them by Gita chapter. */
  function groupByChapter(entries) {
    entries.sort((a, b) => {
      if (a.day != null && b.day != null) return a.day - b.day;
      if (a.day != null) return -1;
      if (b.day != null) return 1;
      return a.title.localeCompare(b.title);
    });

    const byChapter = new Map();
    for (const entry of entries) {
      if (entry.chapter == null) continue;
      const chapterEntries = byChapter.get(entry.chapter) ?? [];
      chapterEntries.push(entry);
      byChapter.set(entry.chapter, chapterEntries);
    }
    return byChapter;
  }

  const otherEntries = [];
  const otherGroups = (await pathExists(OTHER_NOTES_DIR))
    ? await findNoteGroups(OTHER_NOTES_DIR)
    : [];
  for (const group of otherGroups) {
    const metadata = await loadMetadata(group.parentDir);
    for (const file of group.files.filter((f) => !f.endsWith(".hi.md"))) {
      const rawBody = await readFile(path.join(group.notesDir, file), "utf8");
      const baseName = file.replace(/\.md$/, "");
      // Prefixed so every session URL matches the private-path rule.
      const slug = slugify(
        `${OTHER_SESSIONS_SLUG}-${path.relative(OTHER_NOTES_DIR, group.parentDir)}`,
      );
      const title = metadata?.title ?? firstHeading(rawBody) ?? baseName;
      const description = metadata?.duration
        ? `Session notes (${metadata.duration}).`
        : "Session notes.";
      await writeMdx(
        path.join(CONTENT_DIR, `${slug}.mdx`),
        { title, description },
        await transformBody(rawBody, metadata, LANGS.en, null),
      );
      pageCount++;
      otherEntries.push({ slug, title, speaker: metadata?.speaker });
    }
  }
  otherEntries.sort((a, b) => a.slug.localeCompare(b.slug));

  const examEntries = await syncExamPrep();
  const examPageCount = examEntries.en.length + examEntries.hi.length;
  pageCount += examPageCount;

  const entries = entriesByLang.en;
  const entriesByChapter = groupByChapter(entries);

  const ccdPageCount = await syncChaitanyaCharanDas(
    path.join(CONTENT_DIR, LANGS.en.dir),
    `/docs/${LANGS.en.dir}`,
  );
  pageCount += ccdPageCount;

  await writeRootLanding(
    [...entriesByChapter.keys()].sort((a, b) => a - b),
    otherEntries.length > 0,
    examEntries.en.length > 0,
    ccdPageCount > 0,
  );
  await writeBookLibrary(
    path.join(CONTENT_DIR, LANGS.en.dir),
    `/docs/${LANGS.en.dir}`,
    entriesByChapter,
    entries.filter((e) => e.isIntroduction),
    otherEntries,
    examEntries.en,
    ccdPageCount > 0,
  );
  await writeHindiLibrary(
    path.join(CONTENT_DIR, LANGS.hi.dir),
    `/docs/${LANGS.hi.dir}`,
    groupByChapter(entriesByLang.hi),
    entriesByLang.hi.filter((e) => e.isIntroduction),
    examEntries.hi,
  );

  console.log(
    `Synced ${pageCount} note page(s) (${entries.length} lecture(s), ${pageCount - entries.length - otherEntries.length - examPageCount - ccdPageCount} translated, ${ccdPageCount} ${CCD_TEACHER} lecture(s), ${otherEntries.length} other session(s), ${examPageCount} exam Q&A page(s)) into ${path.relative(WEB_ROOT, CONTENT_DIR)}/`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

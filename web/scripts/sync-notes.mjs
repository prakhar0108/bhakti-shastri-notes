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

// The teacher for the whole Bhakti Shastri course; credited on every generated page.
const TEACHER_NAME = "HG Adishyam Prabhuji";

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
    const verseMatch = /^(BG\s*\d+\.\d+)\s*[:\-–]\s*(.*)$/i.exec(node.trim());
    const label = verseMatch
      ? `${verseMatch[1]}: ${conciseLabel(verseMatch[2])}`
      : conciseLabel(node);
    mermaidLines.push(`  N${i + 1}["${escapeMermaidLabel(label)}"]`);
  });
  for (let i = 0; i < nodes.length - 1; i++) {
    mermaidLines.push(`  N${i + 1} --> N${i + 2}`);
  }
  return renderFlowchart(mermaidLines.join("\n"));
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

async function transformBody(rawBody, metadata, strings, counterpartSlug) {
  let body = stripLeadingHeading(rawBody);
  body = body.replace(
    /^##[ \t]+Transcript Verification Flags[ \t]*\r?\n[\s\S]*?(?=^#{1,2}[ \t]+|(?![\s\S]))/gm,
    "",
  );
  body = convertAsciiArrowDiagrams(body);
  body = injectArgumentMapFlowchart(body, strings.flowchartHeading);
  body = await injectVerses(body);
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
    ],
  );
  await writeMetaFile(baseDir, {
    root: "language",
    title: LANGS.en.tabTitle,
    // "index" must be a listed child, not `pagesIndex`: the tab switcher is only rendered
    // for pages Fumadocs can find in `children`, which includes this folder's own landing page.
    pages: ["index", ...books.map((b) => b.slug)],
  });

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
};

/** Build the Hindi navigation tree, listing only the chapters that actually have Hindi notes. */
async function writeHindiLibrary(
  baseDir,
  urlPrefix,
  entriesByChapter,
  introEntries = [],
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
      "</Cards>",
    ],
  );
  await writeMetaFile(baseDir, {
    root: "language",
    title: LANGS.hi.tabTitle,
    pages: ["index", "bhagavad-gita"],
  });

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

/** The `/docs` landing page, which sits outside both language tabs. */
async function writeRootLanding(availableChapters) {
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

  const entries = entriesByLang.en;
  const entriesByChapter = groupByChapter(entries);

  await writeRootLanding([...entriesByChapter.keys()].sort((a, b) => a - b));
  await writeBookLibrary(
    path.join(CONTENT_DIR, LANGS.en.dir),
    `/docs/${LANGS.en.dir}`,
    entriesByChapter,
    entries.filter((e) => e.isIntroduction),
  );
  await writeHindiLibrary(
    path.join(CONTENT_DIR, LANGS.hi.dir),
    `/docs/${LANGS.hi.dir}`,
    groupByChapter(entriesByLang.hi),
    entriesByLang.hi.filter((e) => e.isIntroduction),
  );

  console.log(
    `Synced ${pageCount} note page(s) (${entries.length} lecture(s), ${pageCount - entries.length} translated) into ${path.relative(WEB_ROOT, CONTENT_DIR)}/`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

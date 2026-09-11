#!/usr/bin/env node
// Syncs Bhakti Shastri lecture notes from ../outputs/**/notes/*.md into content/docs/*.mdx.
// The markdown files under outputs/ remain the single source of truth; this script
// (re)generates the Fumadocs content directory from them on every `dev`/`build`.
import { readFile, writeFile, mkdir, rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const OUTPUTS_DIR = path.join(REPO_ROOT, 'outputs');
const CONTENT_DIR = path.join(WEB_ROOT, 'content', 'docs');

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

  const notesDir = entries.find((e) => e.isDirectory() && e.name === 'notes');
  if (notesDir) {
    const notesPath = path.join(dir, 'notes');
    const files = (await readdir(notesPath)).filter((f) => f.endsWith('.md'));
    if (files.length > 0) {
      groups.push({ parentDir: dir, notesDir: notesPath, files });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (['notes', 'transcripts', 'work'].includes(entry.name)) continue;
    await findNoteGroups(path.join(dir, entry.name), groups);
  }

  return groups;
}

function yamlString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractDayNumber(title) {
  const match = /day\s+(\d+)/i.exec(title ?? '');
  return match ? Number(match[1]) : null;
}

function stripLeadingHeading(body) {
  const lines = body.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
    return lines.slice(i).join('\n');
  }
  return body;
}

function escapeMermaidLabel(label) {
  return label
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/_/g, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function splitProse(text) {
  let parts = text.split(/;\s+/);
  if (parts.length < 2) parts = text.split(/,\s*(?:which|therefore|and)\s+/i);
  if (parts.length < 2) parts = [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

function buildFlowchart(nodeLabels, idPrefix = 'N') {
  const lines = ['flowchart TD'];
  nodeLabels.forEach((label, i) => {
    lines.push(`  ${idPrefix}${i + 1}["${escapeMermaidLabel(label)}"]`);
  });
  for (let i = 0; i < nodeLabels.length - 1; i++) {
    lines.push(`  ${idPrefix}${i + 1} --> ${idPrefix}${i + 2}`);
  }
  return lines.join('\n');
}

/** Turn plain (unlabelled) ASCII "│ / ▼" arrow-chain code fences into Mermaid flowcharts. */
function convertAsciiArrowDiagrams(body) {
  return body.replace(/```\n([\s\S]*?)\n```/g, (full, content) => {
    if (!/[│▼]/.test(content)) return full;

    const nodes = [];
    let buffer = [];
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line === '' || line === '│' || line === '▼') {
        if (buffer.length > 0) {
          nodes.push(buffer.join(' '));
          buffer = [];
        }
        continue;
      }
      buffer.push(line);
    }
    if (buffer.length > 0) nodes.push(buffer.join(' '));
    if (nodes.length < 2) return full;

    return '```mermaid\n' + buildFlowchart(nodes) + '\n```';
  });
}

/** Find the "Class Snapshot / Argument Map" section and append a Mermaid flowchart of its argument chain. */
function injectArgumentMapFlowchart(body) {
  const lines = body.split('\n');
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
    if (nextHeadingRe.test(lines[i]) || lines[i].trim() === '---') {
      sectionEnd = i;
      break;
    }
  }
  const section = lines.slice(sectionStart, sectionEnd);

  let argumentText = null;
  for (let i = 0; i < section.length; i++) {
    const line = section[i];
    const boldMatch = /^\s*-?\s*\*\*([^*]*argument[^*]*)\*\*:?\s*(.*)$/i.exec(line);
    if (boldMatch) {
      argumentText = boldMatch[2]?.trim() || section[i + 1]?.trim() || null;
      break;
    }
    if (/^#{2,4}\s*argument in one line/i.test(line)) {
      const next = section.slice(i + 1).find((l) => l.trim() !== '');
      if (next) argumentText = next.replace(/`/g, '').trim();
      break;
    }
  }
  if (!argumentText) return body;

  const tracks = argumentText
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean);

  const mermaidLines = ['flowchart TD'];
  tracks.forEach((track, trackIdx) => {
    const segments = track.includes('->') ? track.split('->').map((s) => s.trim()) : splitProse(track);
    const idPrefix = `T${trackIdx + 1}N`;
    segments.forEach((seg, segIdx) => {
      mermaidLines.push(`  ${idPrefix}${segIdx + 1}["${escapeMermaidLabel(seg)}"]`);
    });
    for (let i = 0; i < segments.length - 1; i++) {
      mermaidLines.push(`  ${idPrefix}${i + 1} --> ${idPrefix}${i + 2}`);
    }
  });

  const flowchartBlock = ['', '#### Argument Map Flowchart', '', '```mermaid', mermaidLines.join('\n'), '```', ''];

  const newLines = [...lines.slice(0, sectionEnd), ...flowchartBlock, ...lines.slice(sectionEnd)];
  return newLines.join('\n');
}

function transformBody(rawBody) {
  let body = stripLeadingHeading(rawBody);
  body = convertAsciiArrowDiagrams(body);
  body = injectArgumentMapFlowchart(body);
  return body.trim();
}

async function loadMetadata(parentDir) {
  const metadataPath = path.join(parentDir, 'metadata.json');
  if (!(await pathExists(metadataPath))) return null;
  try {
    return JSON.parse(await readFile(metadataPath, 'utf8'));
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

  const groups = (await pathExists(OUTPUTS_DIR)) ? await findNoteGroups(OUTPUTS_DIR) : [];
  const entries = [];

  for (const group of groups) {
    const metadata = await loadMetadata(group.parentDir);
    for (const file of group.files) {
      const rawBody = await readFile(path.join(group.notesDir, file), 'utf8');
      const baseName = file.replace(/\.md$/, '');
      const slug = slugify(baseName.replace(/-notes$/, ''));
      const title = metadata?.title ?? firstHeading(rawBody) ?? baseName;
      const description = metadata?.duration
        ? `Bhakti Shastri lecture notes (${metadata.duration}).`
        : 'Bhakti Shastri lecture notes.';

      const frontmatter = ['---', `title: ${yamlString(title)}`, `description: ${yamlString(description)}`, '---', ''].join(
        '\n',
      );

      const content = `${frontmatter}${transformBody(rawBody)}\n`;
      await writeFile(path.join(CONTENT_DIR, `${slug}.mdx`), content, 'utf8');

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
    '---',
    `title: ${yamlString('Bhakti Shastri Notes')}`,
    `description: ${yamlString('All lecture notes, generated from the outputs/ transcripts.')}`,
    '---',
    '',
    entries.length === 0
      ? 'No notes have been generated yet. Run the note generator, then re-run `npm run sync-notes`.'
      : 'Browse every lecture below, or use the search bar in the sidebar to jump to a topic.',
    '',
    '<Cards>',
    ...entries.map((e) => `  <Card title={${yamlString(e.title)}} href="/docs/${e.slug}" />`),
    '</Cards>',
    '',
  ].join('\n');
  await writeFile(path.join(CONTENT_DIR, 'index.mdx'), indexBody, 'utf8');

  const meta = {
    title: 'Bhakti Shastri Notes',
    pages: ['index', ...entries.map((e) => e.slug)],
  };
  await writeFile(path.join(CONTENT_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  console.log(`Synced ${entries.length} note(s) into ${path.relative(WEB_ROOT, CONTENT_DIR)}/`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

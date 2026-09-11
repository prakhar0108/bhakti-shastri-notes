"""Gemini-backed, transcript-only study-note generation."""

from __future__ import annotations

import os
import re
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

DEFAULT_MODEL = "gemini-flash-latest"

WRITER_INSTRUCTION = """
You create rigorous subject-study notes from one supplied YouTube transcript.

The transcript is the complete and exclusive source of truth. You have no tools and
must not use memory, outside scripture, web knowledge, or general subject knowledge.
Do not repair Sanskrit, names, verse numbers, or quotations from prior knowledge.
When captions are unclear, preserve uncertainty and identify the timestamp.

Write notes, not a rewritten transcript. Remove greetings, filler, repetition, and
classroom logistics. Preserve the teacher's reasoning, distinctions, examples,
purport/commentary points explicitly mentioned in the lecture, practical applications,
audience questions, and answers. Distinguish speaker teaching from participant comments.

Use this structure when supported by the transcript:
1. Title and source-discipline note.
2. Class snapshot and one-line argument map.
3. Continuity/recap from the preceding class.
4. Shloka-wise sections. For each shloka include context/question, key terms as the
   teacher explains them, reasoning flow, distinctions, examples, cited purport points,
   practical application, and a compact takeaway.
5. Cross-shloka conceptual map or comparison table.
6. Q&A and participant clarifications.
7. Last-page revision sheet.
8. Transcript verification flags.

Attach timestamp ranges to every major section and narrower timestamps to important
claims. Keep useful Hindi/Sanskrit terms from the transcript alongside clear English.
Never reproduce or reconstruct a full Sanskrit verse, even when it seems familiar.
Retain at most two key Sanskrit terms at a time when the teacher explicitly explains
them. Do not mention information merely because it is usually associated with a verse.
Return Markdown only, without a code fence or preamble.
""".strip()

AUDITOR_INSTRUCTION = """
You are a strict source-grounding editor. Compare the draft notes against the supplied
timestamped transcript, which is the only allowed source.

For every sentence and bullet:
- remove claims, definitions, verse wording, names, or conclusions not directly
  supported by the transcript;
- weaken overconfident paraphrases and flag caption uncertainty by timestamp;
- retain supported reasoning, distinctions, examples, applications, and Q&A detail;
- ensure participant comments are not presented as the teacher's statements;
- remove transcript-like repetition and keep expert study-note organization;
- preserve timestamp traceability.

Do not add corrections or facts from memory. Return the corrected final Markdown only,
without an audit report, code fence, or preamble.
""".strip()

SANSKRIT_DIACRITICS = set("āīūṛṝḷṅñṭḍṇśṣṃḥĀĪŪṚṜḶṄÑṬḌṆŚṢṂḤ")

# Matches sandhi-elision apostrophes (e.g. "loko 'yam", "vo 'stv") that are a
# romanized-IAST convention and never appear in the Devanagari/Hindi transcript.
SANDHI_ELISION_RE = re.compile(r"[A-Za-z]'[aeiouAEIOU]")

# Common Sanskrit nominal case-ending patterns, used to flag ASCII (non-diacritic)
# transliteration that reads like a quoted verse rather than a short gloss.
SANSKRIT_CASE_SUFFIX_RE = re.compile(
    r"\b\w+(?:ah|am|at|atha|ena|aya|asya|artham)\b", re.IGNORECASE
)

# Sanskrit third-person present-tense verb endings (e.g. "vishanti", "bhavati").
# These almost never terminate an English word, so a single hit is enough signal
# on its own, unlike the more ambiguous case-ending suffixes above.
SANSKRIT_VERB_SUFFIX_RE = re.compile(r"\b\w+(?:anti|ante|ati)\b", re.IGNORECASE)

ITALIC_SPAN_RE = re.compile(r"(?<!^)(?<!\*)\*([^*\n]+)\*(?!\*)")
# Same span shape without the bold-avoidance lookarounds, safe to use on an
# already-isolated chain substring (which itself starts with "*").
PLAIN_SPAN_RE = re.compile(r"\*([^*\n]+)\*")

# Two or more italic spans joined only by a comma/slash/semicolon (no other
# prose in between) - the pattern a model uses to fragment one reconstructed
# verse into several short-looking pieces to dodge a per-span length check.
CHAINED_SPANS_RE = re.compile(r"\*[^*\n]+\*(?:\s*[,/;]\s*\*[^*\n]+\*)+")
PLACEHOLDER = "[exact Sanskrit omitted: auto-captions uncertain]"


class GeminiNotesError(RuntimeError):
    """Raised when model-backed note generation cannot be completed."""


def configured_api_key() -> str | None:
    """Load local environment configuration and return a Gemini API key."""

    load_dotenv()
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def gemini_is_configured() -> bool:
    """Return whether the local project has a Gemini API key."""

    return bool(configured_api_key())


def generate_grounded_notes(
    transcript_source: str,
    *,
    video_title: str | None = None,
    video_url: str | None = None,
    model: str = DEFAULT_MODEL,
) -> str:
    """Generate and audit detailed notes using only the supplied transcript."""

    api_key = configured_api_key()
    if not api_key:
        raise GeminiNotesError(
            "GEMINI_API_KEY or GOOGLE_API_KEY is required for Gemini notes mode."
        )

    client = genai.Client(api_key=api_key)
    source_header = "\n".join(
        line
        for line in [
            f"Video title: {video_title}" if video_title else None,
            f"Video URL: {video_url}" if video_url else None,
        ]
        if line
    )
    source_block = (
        f"{source_header}\n\n"
        "<TRANSCRIPT>\n"
        f"{transcript_source.strip()}\n"
        "</TRANSCRIPT>"
    )

    draft_response = client.models.generate_content(
        model=model,
        contents=(
            "Create complete, detailed, transcript-grounded study notes from the "
            f"following source.\n\n{source_block}"
        ),
        config=types.GenerateContentConfig(
            system_instruction=WRITER_INSTRUCTION,
            temperature=0.1,
            max_output_tokens=24000,
        ),
    )
    draft = _response_text(draft_response, "draft")

    audit_response = client.models.generate_content(
        model=model,
        contents=(
            f"{source_block}\n\n"
            "<DRAFT_NOTES>\n"
            f"{draft}\n"
            "</DRAFT_NOTES>\n\n"
            "Return the corrected final notes after the grounding audit."
        ),
        config=types.GenerateContentConfig(
            system_instruction=AUDITOR_INSTRUCTION,
            temperature=0.0,
            max_output_tokens=24000,
        ),
    )
    audited = _response_text(audit_response, "audited notes")
    return enforce_grounding_format(audited)


def write_grounded_notes(
    transcript_source_path: str | Path,
    notes_path: str | Path,
    *,
    video_title: str | None = None,
    video_url: str | None = None,
    model: str = DEFAULT_MODEL,
) -> Path:
    """Generate audited notes from a notes-source file and write them to disk."""

    source_path = Path(transcript_source_path)
    output_path = Path(notes_path)
    notes = generate_grounded_notes(
        source_path.read_text(encoding="utf-8"),
        video_title=video_title,
        video_url=video_url,
        model=model,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(notes, encoding="utf-8")
    return output_path


def _response_text(response: object, stage: str) -> str:
    """Return response text or raise a useful generation error."""

    text = getattr(response, "text", None)
    if not text or not text.strip():
        raise GeminiNotesError(f"Gemini returned no text for the {stage} stage.")
    return text


def enforce_grounding_format(notes: str) -> str:
    """Apply deterministic safeguards to model-generated Markdown notes."""

    lines: list[str] = []
    for line in notes.strip().splitlines():
        if "Sanskrit Verse Segment Cited:" in line:
            timestamp = _last_timestamp(line)
            suffix = f" (`{timestamp}`)" if timestamp else ""
            lines.append(
                "* **Verse recitation:** The teacher recites the shloka, but the "
                "auto-caption text is not used for an exact Sanskrit quotation."
                f"{suffix}"
            )
            continue
        lines.append(_strip_long_sanskrit_spans(line))

    if lines and not any("Source discipline:" in line for line in lines[:12]):
        insertion = (
            "> **Source discipline:** These notes use only the extracted auto-caption "
            "transcript. Exact Sanskrit is not reconstructed from memory; uncertain "
            "wording remains flagged for audio verification."
        )
        lines[1:1] = ["", insertion]

    if not any("Transcript Verification Flags" in line for line in lines):
        lines.extend(
            [
                "",
                "## Transcript Verification Flags",
                "",
                "- Opening prayers, Sanskrit recitations, proper names, and some verse "
                "numbers contain auto-caption noise. Consult the audio before quoting "
                "their exact wording.",
            ]
        )

    return "\n".join(lines).strip() + "\n"


def _strip_long_sanskrit_spans(line: str) -> str:
    """Remove likely reconstructed Sanskrit verse text while keeping short glosses.

    Two passes, both script-agnostic (they do not require Unicode diacritics,
    since plain-ASCII IAST like "karma-bandhanah" is just as ungrounded - the
    transcript source is Devanagari/Hindi and never contains romanized Sanskrit):

    1. Spans chained together with only a comma/slash/semicolon between them are
       evaluated as one unit, because a model can dodge a per-span length check
       by splitting one reconstructed verse into several short-looking pieces.
    2. Any remaining standalone span is checked on its own with a stricter bar,
       so an isolated 1-2 word key-term gloss (explicitly allowed by the writer
       instructions) is never stripped.
    """

    def replace_chain(match: re.Match[str]) -> str:
        spans = PLAIN_SPAN_RE.findall(match.group(0))
        combined = " ".join(spans)
        if SANDHI_ELISION_RE.search(combined) or len(spans) >= 3:
            return PLACEHOLDER
        if len(combined.split()) >= 6:
            return PLACEHOLDER
        return match.group(0)

    line = CHAINED_SPANS_RE.sub(replace_chain, line)

    def replace_span(match: re.Match[str]) -> str:
        value = match.group(1)
        if SANDHI_ELISION_RE.search(value):
            return PLACEHOLDER
        if "..." in value or "…" in value:
            return PLACEHOLDER
        words = value.split()
        diacritic_words = sum(
            1 for word in words if any(char in SANSKRIT_DIACRITICS for char in word)
        )
        if diacritic_words > 0 and (
            len(words) >= 5
            or (len(words) >= 3 and diacritic_words / len(words) >= 0.5)
        ):
            return PLACEHOLDER
        case_suffix_hits = len(SANSKRIT_CASE_SUFFIX_RE.findall(value))
        if len(words) >= 5 and case_suffix_hits >= 3:
            return PLACEHOLDER
        if len(words) >= 3 and case_suffix_hits >= 2:
            return PLACEHOLDER
        if len(words) >= 3 and SANSKRIT_VERB_SUFFIX_RE.search(value):
            return PLACEHOLDER
        return match.group(0)

    return ITALIC_SPAN_RE.sub(replace_span, line)


def _last_timestamp(line: str) -> str | None:
    """Return the final timestamp in a generated note line."""

    matches = re.findall(r"\b\d{2}:\d{2}\b", line)
    return matches[-1] if matches else None

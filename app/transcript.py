"""YouTube transcript extraction and cleaning utilities."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

TIMESTAMP_RE = re.compile(r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2}\.\d{3})")
INLINE_TAG_RE = re.compile(r"<[^>]+>")

# Matches lecture titles like "Day 31 | BG 3.8 - 3.13 | ..." or "Day 12 | Overview + BG - 2.1 | ...".
LECTURE_TITLE_RE = re.compile(
    r"day\s*(?P<day>\d+)\b.*?\bbg\s*[-\u2013]?\s*(?P<chapter>\d+)\.(?P<start>\d+)"
    r"(?:\s*[-\u2013]\s*(?:(?P<end_chapter>\d+)\.)?(?P<end>\d+))?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class TranscriptLine:
    """One cleaned transcript line with a timestamp."""

    start: str
    text: str


@dataclass(frozen=True)
class TranscriptResult:
    """Files and metadata produced by transcript extraction."""

    video_url: str
    video_id: str
    title: str | None
    duration: str | None
    caption_language: str
    slug: str
    lecture_dir: Path
    transcript_path: Path
    notes_source_path: Path
    line_count: int


class TranscriptError(RuntimeError):
    """Raised when transcript extraction cannot be completed."""


def find_yt_dlp() -> str:
    """Find yt-dlp in PATH or common local install locations."""

    executable = shutil.which("yt-dlp")
    if executable:
        return executable

    candidates = [
        Path("/opt/homebrew/bin/yt-dlp"),
        Path("/usr/local/bin/yt-dlp"),
        Path.home() / ".local" / "bin" / "yt-dlp",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    raise TranscriptError("yt-dlp is not installed or is not available on PATH.")


def run_yt_dlp(args: list[str], cwd: Path) -> str:
    """Run yt-dlp and return stdout, raising a useful error on failure."""

    command = [find_yt_dlp(), *args]
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        message = exc.stderr.strip() or exc.stdout.strip() or str(exc)
        raise TranscriptError(f"yt-dlp failed: {message}") from exc

    return completed.stdout


def get_video_metadata(video_url: str, work_dir: Path) -> dict[str, Any]:
    """Fetch minimal metadata for citations and filenames."""

    raw = run_yt_dlp(
        [
            "--skip-download",
            "--dump-single-json",
            "--no-warnings",
            video_url,
        ],
        cwd=work_dir,
    )
    return json.loads(raw)


def download_captions(
    video_url: str,
    work_dir: Path,
    language: str = "hi-orig,hi,en",
) -> Path:
    """Download the best available caption file as VTT and return its path."""

    work_dir.mkdir(parents=True, exist_ok=True)
    language_preferences = [item.strip() for item in language.split(",") if item.strip()]
    errors: list[str] = []

    for preferred_language in language_preferences:
        before = set(work_dir.glob("*.vtt"))
        try:
            run_yt_dlp(
                [
                    "--write-auto-subs",
                    "--write-subs",
                    "--sub-lang",
                    preferred_language,
                    "--sub-format",
                    "vtt",
                    "--skip-download",
                    "--output",
                    "%(id)s.%(ext)s",
                    video_url,
                ],
                cwd=work_dir,
            )
        except TranscriptError as exc:
            errors.append(f"{preferred_language}: {exc}")
            continue

        after = set(work_dir.glob("*.vtt"))
        created = sorted(after - before, key=lambda path: path.stat().st_mtime)
        if not created:
            created = sorted(after, key=lambda path: path.stat().st_mtime)
        suffix = f".{preferred_language}.vtt"
        matches = sorted(path for path in created if path.name.endswith(suffix))
        if matches:
            return matches[-1]

    detail = "; ".join(errors) if errors else "No matching caption files were created."
    raise TranscriptError(
        "No subtitles or automatic captions were downloaded for the requested "
        f"languages ({language}). {detail}"
    )


def clean_vtt_text(vtt_text: str) -> list[TranscriptLine]:
    """Convert YouTube rolling VTT captions into a cleaner timestamped transcript."""

    blocks = re.split(r"\n\s*\n", vtt_text)
    raw_lines: list[TranscriptLine] = []

    for block in blocks:
        lines = block.strip().splitlines()
        if not lines or lines[0].startswith(("WEBVTT", "Kind:", "Language:")):
            continue

        time_line_index = next(
            (index for index, line in enumerate(lines) if "-->" in line),
            None,
        )
        if time_line_index is None:
            continue

        start = lines[time_line_index].split("-->", maxsplit=1)[0].strip()
        if not TIMESTAMP_RE.fullmatch(start):
            continue

        for line in lines[time_line_index + 1 :]:
            cleaned = INLINE_TAG_RE.sub("", line)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            if cleaned:
                raw_lines.append(TranscriptLine(start=start, text=cleaned))

    cleaned_lines: list[TranscriptLine] = []
    for line in raw_lines:
        if line.text in {"[गाना गाने की आवाज़]", "[Music]"}:
            continue
        if cleaned_lines:
            previous = cleaned_lines[-1]
            if line.text == previous.text:
                continue
            if line.text.startswith(previous.text) and len(line.text) > len(
                previous.text
            ):
                cleaned_lines[-1] = TranscriptLine(
                    start=previous.start,
                    text=line.text,
                )
                continue
            if previous.text.startswith(line.text):
                continue
        cleaned_lines.append(line)

    return cleaned_lines


def write_transcript(
    lines: list[TranscriptLine],
    output_path: Path,
    video_url: str,
    title: str | None,
) -> None:
    """Write a timestamped transcript file."""

    with output_path.open("w", encoding="utf-8") as file:
        file.write(f"Source: {video_url}\n")
        if title:
            file.write(f"Title: {title}\n")
        file.write(
            "Note: Cleaned from YouTube captions/auto-captions. "
            "No outside sources were used.\n\n"
        )
        for line in lines:
            file.write(f"[{line.start}] {line.text}\n")


def write_notes_source(lines: list[TranscriptLine], output_path: Path) -> None:
    """Write compact timestamp chunks that the notes agent can safely use."""

    chunks: dict[int, list[str]] = {}
    for line in lines:
        match = TIMESTAMP_RE.fullmatch(line.start)
        if not match:
            continue
        seconds = (
            int(match.group("h")) * 3600
            + int(match.group("m")) * 60
            + int(float(match.group("s")))
        )
        bucket = (seconds // 120) * 120
        chunks.setdefault(bucket, []).append(line.text)

    with output_path.open("w", encoding="utf-8") as file:
        for bucket, chunk_lines in sorted(chunks.items()):
            minutes = bucket // 60
            seconds = bucket % 60
            paragraph = re.sub(r"\s+", " ", " ".join(chunk_lines)).strip()
            file.write(f"\n## {minutes:02d}:{seconds:02d}\n")
            file.write(paragraph + "\n")


def lecture_location(
    output_root: Path,
    title: str | None,
    video_id: str,
) -> tuple[str, Path]:
    """Map a lecture title to a readable slug and `<book>/<chapter>/<day>` folder.

    "Day 31 | BG 3.8 - 3.13 | ..." becomes
    `day-31-bg-3.8-3.13` under `bhagavad-gita/chapter-03/`. Titles that don't follow
    the course naming fall back to the video id under `unsorted/`.
    """

    match = LECTURE_TITLE_RE.search(title or "")
    if not match:
        return video_id, output_root / "unsorted" / video_id

    chapter = int(match.group("chapter"))
    verses = f"{chapter}.{int(match.group('start'))}"
    if match.group("end"):
        end_chapter = int(match.group("end_chapter") or chapter)
        verses += f"-{end_chapter}.{int(match.group('end'))}"

    slug = f"day-{int(match.group('day')):02d}-bg-{verses}"
    directory = output_root / "bhagavad-gita" / f"chapter-{chapter:02d}" / slug
    return slug, directory


def extract_transcript(
    video_url: str,
    output_dir: str | Path = "outputs",
    language: str = "hi-orig,hi,en",
) -> TranscriptResult:
    """Extract captions from a YouTube URL and write transcript artifacts."""

    output_root = Path(output_dir).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    metadata = get_video_metadata(video_url, output_root)
    video_id = metadata.get("id") or "youtube-video"
    title = metadata.get("title")
    duration = metadata.get("duration_string")

    slug, lecture_dir = lecture_location(output_root, title, video_id)
    work_dir = lecture_dir / "work"
    transcript_dir = lecture_dir / "transcripts"
    work_dir.mkdir(parents=True, exist_ok=True)
    transcript_dir.mkdir(parents=True, exist_ok=True)

    vtt_path = download_captions(video_url, work_dir, language=language)
    vtt_path = vtt_path.rename(work_dir / f"{slug}.{vtt_path.name.split('.', 1)[1]}")
    lines = clean_vtt_text(vtt_path.read_text(encoding="utf-8"))
    if not lines:
        raise TranscriptError("Captions were downloaded but no text could be parsed.")

    transcript_path = transcript_dir / f"{slug}-clean-transcript.txt"
    notes_source_path = transcript_dir / f"{slug}-notes-source.md"
    write_transcript(lines, transcript_path, video_url, title)
    write_notes_source(lines, notes_source_path)

    return TranscriptResult(
        video_url=video_url,
        video_id=video_id,
        title=title,
        duration=duration,
        caption_language=vtt_path.name,
        slug=slug,
        lecture_dir=lecture_dir,
        transcript_path=transcript_path,
        notes_source_path=notes_source_path,
        line_count=len(lines),
    )

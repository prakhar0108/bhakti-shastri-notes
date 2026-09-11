"""Command-line workflow for YouTube transcript extraction and notes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.gemini_notes import (
    GeminiNotesError,
    gemini_is_configured,
    write_grounded_notes,
)
from app.notes import write_extractive_notes
from app.transcript import TranscriptError, extract_transcript


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract YouTube captions and create transcript-grounded notes."
    )
    parser.add_argument("youtube_url", help="YouTube video URL")
    parser.add_argument(
        "--output-dir",
        default="outputs",
        help="Directory where transcript and notes files will be written.",
    )
    parser.add_argument(
        "--language",
        default="hi-orig,hi,en",
        help="Comma-separated subtitle language preference for yt-dlp.",
    )
    parser.add_argument(
        "--notes-mode",
        choices=["auto", "gemini", "extractive"],
        default="auto",
        help=(
            "Notes generator: auto uses Gemini when an API key is configured, "
            "otherwise the deterministic extractive fallback."
        ),
    )
    return parser.parse_args()


def run_notes_pipeline(
    youtube_url: str,
    *,
    output_dir: str | Path = "outputs",
    language: str = "hi-orig,hi,en",
    notes_mode: str = "auto",
) -> dict[str, object]:
    """Extract a transcript and build grounded notes, returning run metadata.

    Shared by the CLI and the ADK agent so both paths use the identical
    extraction + draft-plus-grounding-audit note pipeline.
    """

    output_root = Path(output_dir).expanduser().resolve()
    result = extract_transcript(
        youtube_url,
        output_dir=output_root,
        language=language,
    )
    notes_path = output_root / "notes" / (
        result.transcript_path.name.replace("-clean-transcript.txt", "-notes.md")
    )
    use_gemini = notes_mode == "gemini" or (
        notes_mode == "auto" and gemini_is_configured()
    )
    if use_gemini:
        write_grounded_notes(
            result.notes_source_path,
            notes_path,
            video_title=result.title,
            video_url=result.video_url,
        )
        notes_generator = "gemini-draft-plus-grounding-audit"
    else:
        write_extractive_notes(
            result.notes_source_path,
            notes_path,
            video_title=result.title,
        )
        notes_generator = "deterministic-extractive"

    metadata: dict[str, object] = {
        "video_url": result.video_url,
        "title": result.title,
        "duration": result.duration,
        "caption_language": result.caption_language,
        "line_count": result.line_count,
        "transcript_path": str(result.transcript_path),
        "notes_source_path": str(result.notes_source_path),
        "notes_path": str(notes_path),
        "notes_generator": notes_generator,
        "grounding_rule": "Notes are generated only from extracted captions/transcript.",
    }
    metadata_path = output_root / "metadata.json"
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> int:
    args = parse_args()

    try:
        metadata = run_notes_pipeline(
            args.youtube_url,
            output_dir=args.output_dir,
            language=args.language,
            notes_mode=args.notes_mode,
        )
    except (GeminiNotesError, TranscriptError) as exc:
        print(f"Error: {exc}")
        return 1

    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

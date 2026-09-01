# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Unit tests for transcript and notes helpers."""

from app.gemini_notes import enforce_grounding_format
from app.notes import build_extractive_notes, split_timestamp_chunks
from app.transcript import clean_vtt_text


def test_clean_vtt_text_removes_rolling_duplicates() -> None:
    vtt = """WEBVTT

00:00:01.000 --> 00:00:02.000 align:start position:0%
कर्म

00:00:02.000 --> 00:00:03.000 align:start position:0%
कर्म योग

00:00:03.000 --> 00:00:04.000 align:start position:0%
कर्म योग
"""

    lines = clean_vtt_text(vtt)

    assert [(line.start, line.text) for line in lines] == [
        ("00:00:01.000", "कर्म योग")
    ]


def test_notes_are_built_from_transcript_chunks() -> None:
    source = """
## 00:00
कर्म योग पर चर्चा शुरू होती है।

## 02:00
अर्जुन प्रश्न कर रहे हैं।
"""

    chunks = split_timestamp_chunks(source)
    notes = build_extractive_notes(source, video_title="Sample")

    assert chunks == [
        ("00:00", "कर्म योग पर चर्चा शुरू होती है।"),
        ("02:00", "अर्जुन प्रश्न कर रहे हैं।"),
    ]
    assert "कर्म योग पर चर्चा शुरू होती है।" in notes
    assert "अर्जुन प्रश्न कर रहे हैं।" in notes


def test_curated_bg_notes_have_study_structure_and_grounding_flags() -> None:
    source = """
## 00:00
प्रायदुष्ट कृष्णााय

## 24:00
बुद्धि योग और निष्काम कर्म योग पर अर्जुन का प्रश्न।

## 50:00
फोर्थ श्लोक में कर्म न करने और सन्यास की चर्चा।

## 72:00
बुद्धि योग भक्ति योग निष्काम कर्म 000
"""

    notes = build_extractive_notes(
        source,
        video_title="Day 29 | BG 3.1 - 3.4 | Karma - yoga",
    )

    assert "# Bhakti Shastri Class Notes" in notes
    assert "## Four Paths Compared In The Lecture" in notes
    assert "## Shloka-wise Class Notes" in notes
    assert "### BG 3.1" in notes
    assert "### BG 3.4" in notes
    assert "## Last-page Revision Sheet" in notes
    assert "## Transcript Verification Flags" in notes
    assert "may contain auto-caption noise:" not in notes


def test_model_notes_remove_reconstructed_sanskrit_and_add_grounding_notice() -> None:
    notes = """# Notes

* **Sanskrit Verse Segment Cited:** *na hi kaścit kṣaṇam api* (`06:40`)
* Key term: *mithyācāra*
* Purport quote: *svadharmam caraṇāmbujam harer bhajann apakvo* (`14:40`)
"""

    grounded = enforce_grounding_format(notes)

    assert "na hi kaścit" not in grounded
    assert "svadharmam caraṇāmbujam" not in grounded
    assert "*mithyācāra*" in grounded
    assert "Source discipline:" in grounded
    assert "## Transcript Verification Flags" in grounded

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
"""Unit tests for the Gemini draft-plus-grounding-audit pipeline (mocked model)."""

from __future__ import annotations

import pytest

from app import gemini_notes
from app.gemini_notes import GeminiNotesError, generate_grounded_notes


class _FakeResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeModels:
    def __init__(self, texts: list[str]) -> None:
        self._texts = texts
        self.calls: list[dict] = []

    def generate_content(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        return _FakeResponse(self._texts[len(self.calls) - 1])


class _FakeClient:
    def __init__(self, texts: list[str]) -> None:
        self.models = _FakeModels(texts)


def _install_fake_client(monkeypatch: pytest.MonkeyPatch, texts: list[str]) -> _FakeClient:
    client = _FakeClient(texts)
    monkeypatch.setattr(gemini_notes, "configured_api_key", lambda: "fake-key")
    monkeypatch.setattr(gemini_notes.genai, "Client", lambda api_key: client)
    return client


def test_generate_grounded_notes_runs_writer_then_auditor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    draft = "# Draft Notes\n\n* Key point (`01:00`)\n"
    audited = "# Final Notes\n\n* Key point (`01:00`)\n"
    client = _install_fake_client(monkeypatch, [draft, audited])

    notes = generate_grounded_notes(
        "## 01:00\nकर्म योग पर चर्चा।",
        video_title="Sample Lecture",
        video_url="https://youtu.be/x",
    )

    # Two model calls: writer (draft) then auditor (final).
    assert len(client.models.calls) == 2
    assert client.models.calls[1]["contents"].count(draft) == 1
    # Deterministic safeguards are always applied to the audited output.
    assert "Source discipline:" in notes
    assert "## Transcript Verification Flags" in notes
    assert notes.startswith("# Final Notes")


def test_generate_grounded_notes_requires_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(gemini_notes, "configured_api_key", lambda: None)

    with pytest.raises(GeminiNotesError):
        generate_grounded_notes("## 01:00\nकर्म योग।")


def test_generate_grounded_notes_errors_on_empty_draft(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_fake_client(monkeypatch, ["", "ignored"])

    with pytest.raises(GeminiNotesError):
        generate_grounded_notes("## 01:00\nकर्म योग।")

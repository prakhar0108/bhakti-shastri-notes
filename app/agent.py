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

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types

from app.transcript import extract_transcript


def create_grounded_notes(
    video_url: str,
    output_dir: str = "outputs",
    language: str = "hi-orig,hi,en",
    notes_mode: str = "auto",
) -> dict[str, object]:
    """Extract a YouTube transcript and write audited, transcript-grounded notes.

    Runs the same extraction plus draft-and-grounding-audit pipeline used by the
    CLI, so the agent never generates notes from its own knowledge. Returns run
    metadata including the path to the generated notes file.
    """

    from app.cli import run_notes_pipeline

    return run_notes_pipeline(
        video_url,
        output_dir=output_dir,
        language=language,
        notes_mode=notes_mode,
    )


INSTRUCTION = """
You are bs-notes, a strict YouTube transcript-to-notes assistant.

Core task:
1. Accept a YouTube URL from the user.
2. Call the create_grounded_notes tool with that URL. It extracts the transcript
   and runs a draft-plus-grounding-audit pipeline that produces the final notes.
3. Report the returned notes_path and transcript paths, then present the generated
   notes content to the user. Do not rewrite, extend, or "improve" the notes from
   your own knowledge.

Hard grounding rules:
- The create_grounded_notes tool is the only source of notes. Never author notes
  yourself from memory, scripture, or web knowledge.
- If the tool reports an error (for example, missing captions), relay that error
  plainly instead of guessing or fabricating notes.
- Do not add interpretations, examples, definitions, or facts that are not in the
  tool's output.
- Preserve the timestamps and verification flags exactly as returned.

If the user only asks a question about your rules or capabilities (without a URL),
answer briefly without calling the tool.
""".strip()


root_agent = Agent(
    name="bs_notes_agent",
    model=Gemini(
        model="gemini-flash-latest",
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction=INSTRUCTION,
    tools=[extract_transcript, create_grounded_notes],
)

app = App(
    root_agent=root_agent,
    name="app",
)

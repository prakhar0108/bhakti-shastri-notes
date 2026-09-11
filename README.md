# bs-notes

`bs-notes` is a local ADK prototype agent for extracting YouTube captions and creating transcript-grounded notes.

The important rule is strict grounding: notes must use only the extracted video transcript. The agent and CLI must not add outside facts, scriptural commentary, inferred examples, or model "thinking" that is not supported by the transcript.

## Project Structure

```
bs-notes/
├── app/         # Core agent code
│   ├── agent.py               # Main agent logic
│   ├── fast_api_app.py        # FastAPI Backend server
│   └── app_utils/             # App utilities and helpers
├── tests/                     # Unit, integration, and load tests
├── AGENTS.md                  # AI-assisted development guide
└── pyproject.toml             # Project dependencies
```

> 💡 **Tip:** Use [Antigravity CLI](https://antigravity.google/) for AI-assisted development - project context is pre-configured in `AGENTS.md`.

## Requirements

Before you begin, ensure you have:
- **uv**: Python package manager (used for all dependency management in this project) - [Install](https://docs.astral.sh/uv/getting-started/installation/) ([add packages](https://docs.astral.sh/uv/concepts/dependencies/) with `uv add <package>`)
- **agents-cli**: Agents CLI - Install with `uv tool install google-agents-cli`
- **Google Cloud SDK**: For GCP services - [Install](https://cloud.google.com/sdk/docs/install)


## Quick Start

Install `agents-cli` and its skills if not already installed:

```bash
uvx google-agents-cli setup
```

Install required packages:

```bash
agents-cli install
```

Test the agent with a local web server:

```bash
agents-cli playground
```

You can also use features from the [ADK](https://adk.dev/) CLI with `uv run adk`.

## Command-line Usage

The deterministic CLI extracts captions with `yt-dlp`, writes a cleaned transcript, and creates structured study notes from that transcript:

```bash
uv run bs-notes "https://www.youtube.com/watch?v=VIDEO_ID" --output-dir outputs
```

With `GEMINI_API_KEY` or `GOOGLE_API_KEY` configured, the default `auto` mode creates a detailed draft from the full timestamped transcript and then runs a second transcript-only grounding audit. Select a mode explicitly when needed:

```bash
uv run bs-notes "https://www.youtube.com/watch?v=VIDEO_ID" --notes-mode gemini
uv run bs-notes "https://www.youtube.com/watch?v=VIDEO_ID" --notes-mode extractive
```

Outputs:

- `outputs/transcripts/*-clean-transcript.txt`
- `outputs/transcripts/*-notes-source.md`
- `outputs/notes/*-notes.md`
- `outputs/metadata.json`

Requirements:

- `yt-dlp` must be installed and available on `PATH`.
- The video must expose subtitles or automatic captions. If captions are unavailable, the tool reports an error instead of guessing.

## Grounding Contract

- Use only extracted captions/transcript content.
- Preserve timestamps for traceability.
- Mark unclear caption text instead of correcting it from outside knowledge.
- Do not use web search or external references to enrich notes.
- Do not add philosophical, scriptural, or contextual material that is absent from the transcript.

The notes generator prefers subject-study structure over raw transcript chunks. For supported Bhagavad-gita lecture patterns, it creates a class snapshot, argument map, path comparison, shloka-wise reasoning, speaker examples, practical application, Q&A clarifications, a last-page revision sheet, and concise transcript-verification flags. Every major section retains timestamp anchors.

## Commands

| Command              | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `agents-cli install` | Install dependencies using uv                                                         |
| `agents-cli playground` | Launch local development environment                                                  |
| `agents-cli lint`    | Run code quality checks                                                               |
| `agents-cli eval`    | Evaluate agent behavior (generate, grade, analyze, and more — see `agents-cli eval --help`) |
| `uv run pytest tests/unit tests/integration` | Run unit and integration tests                                                        || [A2A Inspector](https://github.com/a2aproject/a2a-inspector) | Launch A2A Protocol Inspector                                                        |

## 🛠️ Project Management

| Command | What It Does |
|---------|--------------|
| `agents-cli scaffold enhance` | Add CI/CD pipelines and Terraform infrastructure |
| `agents-cli infra cicd` | One-command setup of entire CI/CD pipeline + infrastructure |
| `agents-cli scaffold upgrade` | Auto-upgrade to latest version while preserving customizations |

---

## Development

Core files:

- `app/agent.py`: ADK agent definition and strict grounding instructions.
- `app/transcript.py`: YouTube caption extraction and cleaning.
- `app/notes.py`: deterministic transcript-only notes generation.
- `app/cli.py`: command-line workflow.

Test with:

```bash
uv run pytest tests/unit tests/integration
```

The generated live ADK/server integration tests are skipped until either `GEMINI_API_KEY` or a real `GOOGLE_CLOUD_PROJECT` is configured. The transcript extraction and notes helpers are covered by unit tests without requiring model credentials.

Use `agents-cli playground` for interactive ADK testing.

## Deployment

```bash
gcloud config set project <your-project-id>
agents-cli deploy
```

To add CI/CD and Terraform, run `agents-cli scaffold enhance`.
To set up your production infrastructure, run `agents-cli infra cicd`.

## Observability

Built-in telemetry exports to Cloud Trace, BigQuery, and Cloud Logging.

## A2A Inspector

This agent supports the [A2A Protocol](https://a2a-protocol.org/). Use the [A2A Inspector](https://github.com/a2aproject/a2a-inspector) to test interoperability.
See the [A2A Inspector docs](https://github.com/a2aproject/a2a-inspector) for details.

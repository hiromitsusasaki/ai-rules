# ai-rules

Manage your personal AI agent rules as a single source of truth (`atoms/*.yaml`) and distribute them to multiple AI tools via a CLI pipeline.

## Features

- **Single Source of Truth** -- all rules live in `atoms/*.yaml`; SSOT is never modified automatically
- **Propose-then-approve workflow** -- ingested material becomes a proposal; changes are applied only after manual review
- **Multi-target build** -- one set of atoms generates output for Claude Code, Codex, Copilot, Gemini, Cursor, OpenCode, OpenClaw, and ChatGPT custom instructions
- **Two operating modes** -- Global mode (`~/.config/ai-rules/`) for personal rules, Project mode (`.ai-rules/` in a repo) for per-project rules
- **Optional LLM assist** -- uses OpenAI API for smarter proposals and target-specific optimization; falls back gracefully when no API key is set

## Requirements

- Node.js >= 18

## Installation

```bash
git clone https://github.com/hiromitsusasaki/ai-rules.git
cd ai-rules
npm install
```

To make the `ai-rules` command available globally:

```bash
npm link
```

## Quick Start

```bash
# 1. Ingest a source
ai-rules ingest --text "Always reply in Japanese"

# 2. Generate a proposal
ai-rules propose --last

# 3. Review proposals/<id>/summary.md and patch.diff, then apply manually

# 4. Build target files
ai-rules build

# 5. Install to each tool's config location
ai-rules install

# 6. Verify
ai-rules doctor
```

## Commands

| Command | Description |
|---------|-------------|
| `ai-rules init [--source <path>]` | Bootstrap atoms from existing rule files |
| `ai-rules ingest <url>` | Ingest from URL |
| `ai-rules ingest --text "..."` | Ingest from text |
| `ai-rules ingest --stdin` | Ingest from stdin |
| `ai-rules ingest --file <path>` | Ingest from file |
| `ai-rules propose --last` | Create proposal from latest inbox item |
| `ai-rules approve --last` | Approve latest proposal (project mode) |
| `ai-rules build` | Render atoms into target-specific files in `dist/` |
| `ai-rules install` | Deploy dist files to each tool's config path |
| `ai-rules configure` | Set OpenAI API key |
| `ai-rules doctor` | Check YAML schema, broken links, and config health |
| `ai-rules status` | Show pending proposals and overdue reviews |

## Pipeline

```
ingest → distill → reconcile → patch → build → install
```

1. **Ingest** -- URL / text / stdin / file are normalized into `inbox/*.md` with frontmatter
2. **Distill** -- Extracts normative statements from inbox text (regex-based, no LLM required)
3. **Reconcile** -- Compares candidate atoms against existing atoms using Jaccard similarity; classifies as update / create / conflict / drop
4. **Patch** -- Generates a unified diff and saves it to `proposals/<id>/patch.diff`
5. **Build** -- Renders `atoms/*.yaml` into `dist/<target>/` for each enabled target
6. **Install** -- Deploys dist files via symlink or copy to their configured destinations

## Build Targets

| Target | Output | Format |
|--------|--------|--------|
| chat | `dist/chat/custom_instructions.txt` | must/should rules only |
| claude-code | `dist/claude-code/CLAUDE.md` | Structured Markdown |
| codex | `dist/codex/AGENTS.md` | Structured Markdown |
| copilot | `dist/copilot/copilot-instructions.md` | Structured Markdown |
| gemini | `dist/gemini/GEMINI.md` | Structured Markdown |
| opencode | `dist/opencode/AGENTS.md` | Structured Markdown |
| cursor | `dist/cursor/ai-rules.mdc` | Markdown with YAML frontmatter |
| openclaw | `dist/openclaw/.../SKILL.md` | Skill document |

## Operating Modes

### Global Mode

Activated when running from `~/.config/ai-rules/` (or `AI_RULES_ROOT` env var). Manages your personal cross-project rules via `atoms/*.yaml`.

### Project Mode

Activated when the current directory contains `.ai-rules/`. Uses `.ai-rules/project.md` as the source and generates target-specific rule files scoped to the project.

## Configuration

### Global: `config/config.yaml`

```yaml
propose:
  max_must_additions: 3
patch:
  mode: diff
targets:
  enabled:
    - chat
    - claude-code
    - codex
    - copilot
    - gemini
    - opencode
    - cursor
    - openclaw
install:
  mode: symlink        # symlink | copy
  on_conflict: backup  # backup | overwrite | skip
  destinations:
    claude-code: "~/.claude/CLAUDE.md"
    codex: "~/.codex/AGENTS.md"
    # ...
```

### Project: `.ai-rules/config.yaml`

```yaml
mode: project
source: project.md
targets:
  enabled:
    - claude-code
    - codex
install:
  mode: copy
  on_conflict: overwrite   # no backup needed under git
  destinations:
    claude-code: "./CLAUDE.md"
    codex: "./AGENTS.md"
```

### Install conflict strategies

| Value | Behavior |
|-------|----------|
| `backup` | Renames existing file to `<path>.bak` (keeps only the latest backup) |
| `overwrite` | Removes existing file and installs new one without backup |
| `skip` | Leaves existing file untouched |

> **Tip:** For git-managed project directories, `overwrite` is recommended since version history serves as backup.

## Atom Schema

Each atom in `atoms/*.yaml` follows this schema (see `atoms/schema.json`):

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique identifier |
| `category` | yes | `style` / `format` / `thinking` / `research` |
| `priority` | yes | `must` / `should` / `may` |
| `text` | yes | Rule text (max 280 chars) |
| `rationale` | no | Why this rule exists |
| `examples` | no | Usage examples |
| `sources` | no | Reference URLs |
| `status` | no | `stable` / `experimental` / `deprecated` |
| `review_after` | no | Date to re-evaluate the rule |

## LLM Integration (Optional)

ai-rules can use the OpenAI API (`gpt-4.1-mini`) for:

- Generalizing personal rules during `init`
- Target-specific optimization during `build`
- Merge suggestions during `ingest`

Configure with:

```bash
ai-rules configure
# or set OPENAI_API_KEY environment variable
```

When no API key is available, all commands fall back to LLM-free operation.

## Directory Structure

```
atoms/           # Source of truth (YAML rule atoms)
inbox/           # Ingested raw materials
proposals/       # Generated proposals (summary, candidates, plan, diff)
dist/            # Built target files
config/          # Global configuration
src/             # CLI source code
  commands/      # Command implementations
  lib/           # Core libraries (build, install, distill, reconcile, ...)
.ai-rules/       # Project-mode config and dist (per-repo)
```

## License

MIT

## Related Docs

- [USAGE.md](USAGE.md) -- Day-to-day usage guide
- [docs/design.md](docs/design.md) -- Design document
- [docs/requirement.md](docs/requirement.md) -- Requirements
- [docs/atoms-guide.md](docs/atoms-guide.md) -- Atom authoring guide

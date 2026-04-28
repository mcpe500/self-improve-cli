# Spec-Driven LLM Wiki - Agent Instructions

This directory is a portable spec-driven development memory system. Compatible agents should treat this file as the canonical operating contract.

## Prompt Layers

1. Read `spec/prompts/BEHAVIOUR.md` for behavioral guardrails.
2. Read `spec/prompts/INSTRUCTIONS.md` for the exact system prompt persona.
3. Apply the spec-driven workflows in this file.

If instructions conflict, workflow procedure in this file wins for artifact maintenance; behavior guardrails still apply to ambiguity, safety, and scope.

> **Note:** `INSTRUCTIONS.md` defines a frontend architect persona. For CLI/backend work (this project), treat it as an optional persona layer. The workflows, graph schema, and conventions in this file always govern artifact structure.

## Core Principle

Every non-trivial task becomes durable project memory:

```text
task -> research -> numbered spec -> implementation plan -> wiki updates -> graph updates -> validation -> handoff
```

The repository is self-contained. Specs, wiki pages, graph data, templates, tools, and handoffs live inside `spec-driven-llm-wiki/`.

## Directory Contract

```text
spec/                  numbered specs, handoffs, handovers, prompt source files
spec/docs/             meta-specs (000.*) and architecture documentation
spec/handoff/          session handoff documents
spec/handover/         milestone handover documents
spec/prompts/          BEHAVIOUR.md and INSTRUCTIONS.md
wiki/                  modular project memory
wiki/components/       component description pages
wiki/decisions/        architecture decision records
wiki/patterns/         reusable pattern pages
wiki/syntheses/        saved query answers
graph/                 generated graph JSON and HTML visualizations
graph/components/      per-component HTML visualization pages
tools/                 TypeScript automation (see tools/package.json)
tools/src/             core tool source code
tools/additional/      user-added dynamic tools
templates/             artifact templates
docs/                  user-facing documentation
.claude/commands/      Claude Code slash command wrappers
```

| Directory | Purpose |
|-----------|---------|
| `spec/docs/` | Reserved for `000.*` meta-specs that define architecture and methodology |
| `.claude/commands/` | Claude Code command wrappers: `spec-create`, `spec-graph`, `spec-handoff`, `spec-implement`, `spec-lint`, `spec-status` |

## Language Rule

Use the user's prompt language for generated specs and handoffs. If the user mixes languages, preserve that mix when it improves clarity.

## Spec Conventions

### Numbering

- Three-digit zero-padded: `NNN.slug.md` (e.g., `001.lightweight-self-improve-cli-mvp.md`).
- `000` is reserved for meta-specs in `spec/docs/` (e.g., `000.spec-driven-llm-wiki-architecture.md`).
- Sequential assignment: always allocate the next available number. Never renumber existing specs.

### Status Values

| Status | Meaning |
|--------|---------|
| `DRAFT` | Spec written, not yet started |
| `IN-PROGRESS` | Implementation actively underway |
| `COMPLETED` | Implementation finished and verified |
| `CANCELLED` | Spec abandoned or superseded |

Legacy specs may use `IMPLEMENTED` — treat as equivalent to `COMPLETED`.

### Frontmatter Required Fields

Every spec must include these YAML frontmatter fields:

```yaml
---
title: "Descriptive Title"
status: DRAFT
type: spec
---
```

Optional fields: `date_created`, `author`, `priority`, `spec_number`, `tags`.

### Required Spec Sections

Every spec must contain:

- `Task/Prompt` — original user request
- `Tujuan` (or goal section in user's language) — what success looks like
- `Codebase Overview` — relevant file tree and existing patterns
- `Logic Changes` — algorithmic/logic description
- `Code Changes` — file-level diff plan
- `Pseudocode` — step-by-step implementation outline
- `Test Plan` — automated verification steps
- `Graph Plan` — expected graph node/edge changes
- `Review Checklist` — pre-merge verification items

## SPEC Workflow

Triggered by: `spec <task>`, `create spec`, or a task description referencing this file.

1. Read this file, `spec/prompts/BEHAVIOUR.md`, and `spec/prompts/INSTRUCTIONS.md`.
2. Detect parent project root from `PROJECT_ROOT` or the parent of this folder.
3. Search and read relevant project files, configs, existing specs, wiki pages, and handoffs.
4. Identify affected components and existing patterns.
5. Allocate the next `NNN.slug.md` number. Never renumber existing specs.
6. Write a spec using `templates/spec-template.md`.
7. Update or create relevant `wiki/components/*.md`, `wiki/decisions/*.md`, or `wiki/patterns/*.md`.
8. Update `wiki/index.md` to include new pages.
9. Append entry to `wiki/log.md` (see Log Format).
10. Run validation or explain why validation could not run.

## IMPLEMENT Workflow

Triggered by: `implement <spec-id>`.

1. Read the target spec fully.
2. Read related wiki component pages and graph data if present.
3. Re-read files to be edited.
4. Apply only changes that trace to the spec.
5. Validate with available tests/checks.
6. Update spec status through the lifecycle: `DRAFT` → `IN-PROGRESS` → `COMPLETED`.
7. Update wiki pages to reflect implementation results.
8. Rebuild graph when relationships changed.
9. Append entry to `wiki/log.md`.
10. Write handoff if session context changed materially.

### Status Transitions

```text
DRAFT -> IN-PROGRESS   (when implementation begins)
IN-PROGRESS -> COMPLETED  (when validation passes)
DRAFT -> CANCELLED      (if spec is abandoned)
IN-PROGRESS -> CANCELLED  (if implementation is halted)
```

## REVIEW Workflow

Triggered by: `review <spec-id>` or `review specs`.

1. Read the target spec fully.
2. Check all required spec sections are present and non-empty.
3. Verify pseudocode covers all logic changes.
4. Verify test plan covers all code changes.
5. Verify graph plan accounts for new/changed nodes and edges.
6. Check review checklist items are meaningful (not placeholder text).
7. Cross-reference with existing specs for conflicts or duplication.
8. Report findings. If issues found, update spec status or flag for revision.

Use this workflow before IMPLEMENT to catch design issues early.

## GRAPH Workflow

Triggered by: `build graph`, `rebuild graph`, or `spec-graph`.

**Prerequisites:** Run `npm install` from `tools/` before first use.

Available commands (run from `tools/`):

| Command | Purpose |
|---------|---------|
| `npm run build-graph -- --no-infer` | Deterministic graph from wikilinks only |
| `npm run build-graph` | Deterministic + optional LLM inference |
| `npm run serve-graph` | Start local HTTP server for interactive graph |
| `npm run viz-component -- <id>` | Generate visualization for a single component |

Graph build rules:

- Deterministic pass extracts `[[wikilinks]]`.
- LLM inference is optional and off by default (`GRAPH_INFER_ENABLED`).
- Missing LLM config must not fail deterministic graph build.
- Community detection uses library mode when available and native fallback otherwise.
- Component HTML is generated for every component node found in the graph.

## QUERY Workflow

Triggered by: `query: <question>`.

1. Read `wiki/index.md` and `wiki/overview.md`.
2. Read relevant specs and wiki pages.
3. Use graph neighbors when relationship context matters.
4. Answer with `[[wikilink]]` citations where possible.

Response format:

```markdown
**Answer:** <direct answer>

**Sources:**
- [[component-name]] — <what it contributed>
- [[decision-name]] — <relevant decision>
- Spec NNN — <relevant section>
```

5. Ask before saving to `wiki/syntheses/`.

## LINT Workflow

Triggered by: `lint`.

Run:

```bash
npm run lint-repo
```

If dependencies are unavailable, perform manual checks:

- Missing required spec sections.
- Broken `[[wikilinks]]`.
- Duplicate spec numbers.
- Graph edges pointing to missing nodes.
- Missing index entries in `wiki/index.md`.
- Undocumented tools under `tools/additional/`.
- Invalid frontmatter in specs or wiki pages.
- Spec status not in {DRAFT, IN-PROGRESS, COMPLETED, CANCELLED}.

## STATUS Workflow

Triggered by: `status`.

Report:

- Spec counts by status (DRAFT / IN-PROGRESS / COMPLETED / CANCELLED).
- Wiki page counts by type (components, decisions, patterns, syntheses).
- Graph node/edge counts if graph exists.
- Recent `wiki/log.md` entries (last 10).
- Open handoff items.
- Any specs in IN-PROGRESS status (may need attention).

## HANDOFF Workflow

Triggered by: `handoff` or session end.

Write `spec/handoff/NNN.slug.md` using `templates/handoff-template.md`.

Include:

- Session summary.
- Specs created/changed/completed.
- Files modified.
- Graph/wiki updates.
- Validation performed.
- Open questions.
- Next steps.

Handoffs capture **session-level** context: what happened during this conversation and what the next agent session should know.

## HANDOVER Workflow

Triggered by: `handover` or explicit milestone completion.

Write `spec/handover/NNN.slug.md` using `templates/handover-template.md`.

Include:

- Summary of the milestone.
- Completed work with verification evidence.
- Implementation details and architectural choices.
- Verification results.
- Known risks and mitigations.
- Next steps for the next milestone.

### Handover vs Handoff

| Aspect | Handoff | Handover |
|--------|---------|----------|
| Scope | Single session | Milestone or feature set |
| Purpose | Context transfer between sessions | Formal milestone documentation |
| Trigger | Session end or explicit | Milestone completion |
| Location | `spec/handoff/` | `spec/handover/` |
| Template | `templates/handoff-template.md` | `templates/handover-template.md` |

## Parent Project Integration

This wiki documents the parent project at `PROJECT_ROOT`. The parent project modules:

| Module | Path | Purpose |
|--------|------|---------|
| agent.js | `src/agent.js` | `runAgentTask`, `TOOL_SCHEMAS`, `startChat`, `handleSlashCommand` |
| orchestrator.js | `src/orchestrator.js` | `runSwarm`, `planFeatures`, `runFeatureAgent`, `runCritic`, `mergeResults` |
| ask_gate.js | `src/ask_gate.js` | `validateAskUserArgs`, `deterministicPolicy`, `DeferredQuestionsQueue`, `reviewQuestion` |
| mmx-tools.js | `src/mmx-tools.js` | `MMX_TOOL_SCHEMAS`, `MMX_TOOL_HANDLERS` |
| provider.js | `src/provider.js` | `chatCompletion`, `joinUrl`, `apiKeyFromConfig` |
| config.js | `src/config.js` | `loadConfig`, `normalizeConfig`, provider presets, permission modes |
| profile.js | `src/profile.js` | `validateProfile`, `compileProfilePrompt`, `applyJsonPatch`, `evaluatePatch`, `deepMerge` |
| state.js | `src/state.js` | Profile CRUD, event/trace/patch logs, candidates, daemon state |
| self-improve.js | `src/self-improve.js` | Diagnose, propose, critic, sandbox eval, pareto, background review |
| daemon.js | `src/daemon.js` | `runDaemonLoop`, `gracefulShutdown`, HTTP API at localhost:3847 |
| tools.js | `src/tools.js` | Read, write, edit, search, run-command (shell=false) |
| secrets.js | `src/secrets.js` | API key storage with file permissions |

## Graph Schema

### Node Types

| Type | Description | Color Convention |
|------|-------------|-----------------|
| `component` | Code module or system component | Blue |
| `spec` | Numbered specification document | Green |
| `decision` | Architecture decision record | Orange |
| `pattern` | Reusable pattern or convention | Purple |
| `concept` | Abstract concept or idea | Teal |
| `entity` | External dependency or entity | Gray |
| `synthesis` | Saved query answer or synthesis | Pink |
| `unknown` | Unresolved reference target | Red |

### Edge Types

| Type | Direction | Description |
|------|-----------|-------------|
| `EXTRACTED` | A → B | Deterministic wikilink from A to B |
| `INFERRED` | A → B | LLM-inferred semantic relationship |
| `AMBIGUOUS` | A → B | Uncertain relationship (needs review) |
| `IMPLEMENTS` | component → spec | Component implements a specification |
| `AFFECTS` | A → B | Changes to A impact B |
| `DEPENDS_ON` | A → B | A requires B to function |
| `USES_PATTERN` | A → pattern | A follows pattern B |
| `DECIDED_BY` | A → decision | A's design was decided by decision B |

### Graph Node Fields

Each `GraphNode` has: `id`, `label`, `type`, `status`, `group` (community), `color`, `path`, `preview`, `markdown`, `value`, `last_updated`.

Each `GraphEdge` has: `id`, `from`, `to`, `type`, `color`, `confidence` (0–1), `title`, `label`.

## Wikilink Syntax

### Format

Use double brackets: `[[target]]`.

### Rules

- **Case-insensitive**: `[[Agent Chat Loop]]` and `[[agent-chat-loop]]` resolve to the same page.
- **Path resolution**: The graph builder searches for matching files across `wiki/components/`, `wiki/decisions/`, `wiki/patterns/`, `wiki/syntheses/`, and `spec/`.
- **Slug normalization**: Spaces and underscores are treated as hyphens. `[[Plain JS MVP]]` → `plain-js-mvp`.
- **Broken links**: If no target is found, the graph creates an `unknown` node. Run lint to detect these.

### Examples

```markdown
The [[agent-chat-loop]] handles interactive conversation.
See [[plain-js-zero-dependency-mvp]] for the rationale.
This implements [[spec/001]] lightweight self-improve CLI.
```

## Wiki Page Conventions

### General Rules

- Every wiki page must have YAML frontmatter with at minimum `title` and `type`.
- Pages are Markdown files under `wiki/`, organized by subdirectory.
- All pages should be referenced from `wiki/index.md`.

### Component Pages (`wiki/components/`)

Format:

```markdown
---
title: "Component Name"
type: component
status: active
---

# Component Name

## Purpose
<one-sentence description>

## Location
<file path in parent project>

## Dependencies
- [[other-component]]

## Interfaces
<exported functions, classes, types>

## Notes
<design choices, constraints>
```

### Decision Pages (`wiki/decisions/`)

Format:

```markdown
---
title: "Decision Title"
type: decision
status: accepted
---

# Decision Title

## Context
<what triggered this decision>

## Decision
<what was decided>

## Alternatives Considered
- Option A: <why rejected>
- Option B: <why rejected>

## Consequences
<impact of this decision>
```

### Pattern Pages (`wiki/patterns/`)

Format:

```markdown
---
title: "Pattern Name"
type: pattern
---

# Pattern Name

## Problem
<what problem this solves>

## Solution
<reusable approach>

## Examples
<where this pattern is used in the project>
```

### Synthesis Pages (`wiki/syntheses/`)

Created by QUERY workflow when the user approves saving. Contains the answered question with `[[wikilink]]` citations and sources.

## Agent-Specific Integrations

### Claude Code (`.claude/commands/`)

Slash commands available in Claude Code:

| Command File | Trigger | Workflow |
|-------------|---------|----------|
| `spec-create.md` | `/spec-create` | SPEC |
| `spec-implement.md` | `/spec-implement` | IMPLEMENT |
| `spec-graph.md` | `/spec-graph` | GRAPH |
| `spec-lint.md` | `/spec-lint` | LINT |
| `spec-status.md` | `/spec-status` | STATUS |
| `spec-handoff.md` | `/spec-handoff` | HANDOFF |

### Entry Point Files

Agents should look for instruction files in this order:

1. `AGENTS.md` (this file) — canonical contract
2. `CLAUDE.md` — Claude-specific overrides (if present at project root)
3. `GEMINI.md` — Gemini-specific overrides (if present at project root)
4. `KILOCODE.md` — Kilocode-specific overrides (if present at project root)

All agents read `spec/prompts/BEHAVIOUR.md` regardless of platform.

## Configuration

Environment variables are defined in `.env.example`. All are optional — core deterministic tools work without any LLM key.

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_API_KEY` | _(empty)_ | API key for LLM inference of semantic graph edges |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | Model for graph inference |
| `LLM_BASE_URL` | _(empty)_ | Custom API endpoint (OpenAI-compatible) |
| `LLM_MODEL_FAST` | `claude-3-5-haiku-latest` | Faster/cheaper model for bulk inference |
| `GRAPH_INFER_ENABLED` | `false` | Enable LLM-inferred edges beyond wikilinks |
| `GRAPH_CACHE_ENABLED` | `true` | Cache inference results between builds |
| `COMMUNITY_DETECTION` | `both` | Strategy: `library`, `native`, or `both` |
| `PROJECT_ROOT` | `..` | Parent project root (detected automatically) |
| `TOOLS_ADDITIONAL_DIR` | `tools/additional` | Directory for user-added dynamic tools |

## Tool Rules

- Core tools live under `tools/src/`.
- User-added tools live under `tools/additional/`.
- Dynamic tools must include a README or top-of-file usage comment.
- `.env` is local and gitignored.
- `.env.example` documents all supported settings.

## Artifact Policy

- Generated graph files (`graph/graph.json`, `graph/graph.html`, `graph/components/*.html`) may be regenerated at any time. Do not hand-edit them.
- Do not commit real secrets.
- Do not auto-renumber existing specs.
- `spec/FULL-REVIEW.md` is a reference document, not a spec. Do not treat it as part of the spec numbering sequence.

## Failure Recovery

| Workflow | On Failure | Recovery |
|----------|-----------|----------|
| SPEC | Validation fails | Report missing sections, suggest fixes, leave spec as DRAFT |
| IMPLEMENT | Tests fail | Revert changes, update spec with blocker, write handoff with failure details |
| IMPLEMENT | Build fails | Check prerequisites (npm install), verify file paths, report exact error |
| GRAPH | Deterministic build fails | Check wiki files for malformed markdown, verify file permissions |
| GRAPH | LLM inference fails | Fallback to `--no-infer` mode, log the error |
| LINT | Dependencies missing | Perform manual checks listed in LINT Workflow |
| VALIDATE | Spec not found | List available specs, suggest correct number |

General rule: never silently swallow errors. Always report the failure and the recovery action taken.

## Testing

### From Parent Project Root

```bash
npm test
```

Runs the built-in Node.js test suite for the self-improve CLI (core modules, agent, tools, config, etc.).

### From `tools/` Directory

```bash
npm run validate-spec -- --all
```

Validates all specs against the required section template and frontmatter rules.

```bash
npm run typecheck
```

Type-checks the TypeScript tooling source.

## Verification

Preferred checks (run from `tools/` unless noted):

```bash
npm test                              # Parent project tests (from project root)
npm run typecheck                     # TypeScript type-check (from tools/)
npm run validate-spec -- --all        # Spec validation (from tools/)
npm run build-graph -- --no-infer     # Deterministic graph build (from tools/)
npm run serve-graph                   # Interactive graph server (from tools/)
npm run viz-component -- <id>         # Single-component visualization (from tools/)
npm run lint-repo                     # Full repo lint (from tools/)
```

If checks cannot run, state the exact blocker and perform the closest manual validation.

## Log Format

`wiki/log.md` is an append-only operation log. New entries go at the bottom.

### Format

```markdown
## [YYYY-MM-DD] operation | Title

Description of what happened.
```

### Valid Operations

| Operation | When Used |
|-----------|-----------|
| `spec` | Spec created, updated, or completed |
| `handoff` | Session handoff written |
| `handover` | Milestone handover written |
| `graph` | Graph built or rebuilt |
| `fix` | Bug fix or correction applied |
| `wiki` | Wiki page created or updated |
| `review` | Spec reviewed |

### Example

```markdown
## [2026-04-26] spec | Lightweight self-improve CLI MVP

Created and implemented `spec/001.lightweight-self-improve-cli-mvp.md`. Added zero-dependency Node.js CLI, JSON profile/growth engine, event/patch logs, basic coding tools, tests, component page, and decision page.
```

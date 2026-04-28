# Multi-Layer Subagent Orchestration Architecture

## Overview

This document describes the concrete architecture for a multi-layer subagent orchestration system in `self-improve-cli`. It enables a single user prompt containing N features to be split, executed in parallel by isolated feature agents, reviewed by critics, and merged back into a unified result.

---

## Layer Diagram

```
User Prompt (N features)
    |
    v
+-------------------------+
| Layer 1: Orchestrator   |
| - Parses prompt         |
| - Splits into N features|
| - Spawns N Feature Agents|
|   (parallel, limited    |
|    concurrency)         |
+-------------------------+
    |           |           |
    v           v           v
+----------+ +----------+ +----------+
| Feature  | | Feature  | | Feature  |
| Agent 1  | | Agent 2  | | Agent N  |
| (Layer 2)| | (Layer 2)| | (Layer 2)|
+----+-----+ +----+-----+ +----+-----+
     |            |            |
     v            v            v
+----+-----+ +----+-----+ +----+-----+
| Worker   | | Worker   | | Worker   |
| (tools)  | | (tools)  | | (tools)  |
+----+-----+ +----+-----+ +----+-----+
     |            |            |
     v            v            v
+----+-----+ +----+-----+ +----+-----+
| Critic   | | Critic   | | Critic   |
| (review) | | (review) | | (review) |
+----+-----+ +----+-----+ +----+-----+
     |            |            |
     v            v            v
+----+-----+ +----+-----+ +----+-----+
| Feature  | | Feature  | | Feature  |
| Synthesis| | Synthesis| | Synthesis|
+----+-----+ +----+-----+ +----+-----+
     |            |            |
     +------------+------------+
                  |
                  v
         +------------------+
         | Orchestrator     |
         | Merge Results    |
         +------------------+
                  |
                  v
           Unified Report
```

---

## 1. Communication Protocol

### In-Process (Primary)
- **Mechanism**: Standard JavaScript async function calls and object passing.
- **Why**: No IPC overhead, no serialization complexity, shared Node.js event loop for I/O-bound LLM calls.
- **Data format**: Plain JS objects (`{ status, text, messages, ... }`).

### On-Disk Audit Trail (Secondary)
- **Mechanism**: JSON files written to `.selfimprove/swarm/<run-id>/`.
- **Files**:
  - `plan.json` — orchestrator's feature decomposition
  - `feature-<id>/worker.json` — worker execution trace
  - `feature-<id>/critic.json` — critic review result
  - `results.json` — final merged output
- **Why**: Observability, replayability, and debugging. Does not block hot path.

### Agent Boundaries
Each "agent" is not an OS process. It is a specialized invocation of `runAgentTask()` with:
- A scoped system prompt
- A restricted conversation history
- Optional extended tool schemas (e.g., mmx tools)

---

## 2. Context Isolation

### Orchestrator (Layer 1)
**Receives**:
- Full user prompt
- Workspace metadata (`cwd`, `platform`, `package.json` existence)
- Active profile and config

**Does NOT receive**:
- Full file contents (it may search if needed, but planning is high-level)

**Produces**:
- Array of feature objects: `{ id, title, description, dependencies, estimated_effort }`

### Feature Agent (Layer 2)
**Receives**:
- Single feature description (title + description + dependencies)
- Full tool set (read, write, edit, search, run_command, mmx tools)
- No access to other features' prompts or outputs

**Isolation guarantees**:
- Each feature agent gets its own `AbortController`
- Each has an independent `runAgentTask` loop
- History is scoped to that feature only

### Worker (within Feature Agent)
**Is**: The tool-execution phase of `runAgentTask`.
**Receives**: Same context as the Feature Agent.
**Executes**: File reads/writes/edits, searches, commands.

### Critic (within Feature Agent)
**Receives**:
- Feature description
- Worker's final text / `task_complete` summary
- List of files touched (extracted from message history)
- Verification status

**Does NOT receive**:
- Write/edit permissions
- Full message history (only a summary and touched files)

**Produces**:
- JSON review: `{ approved, feedback, severity, suggested_fixes }`

---

## 3. Error Handling

### Per-Feature Failure Isolation
- Feature agents run via `Promise.allSettled()`.
- If one feature throws or hits max turns, others continue unaffected.
- Failed features are captured in the `failed` array of the merged result.

### Critic Rejection
- If critic rejects, the feature agent may retry (up to `maxCriticIterations`, default 1).
- Retry injects critic feedback as a new user message into the worker's history.
- If still rejected after max iterations, feature status becomes `completed_with_warnings`.

### Orchestrator-Level Retry
- The orchestrator does NOT automatically retry failed features.
- It reports all successes, warnings, and failures in the final merged object.
- The caller (CLI or user) decides whether to retry.

### Abort Handling
- Each feature agent respects a shared `AbortSignal`.
- SIGINT cancels pending LLM calls and terminates the swarm gracefully.

---

## 4. mmx-cli Integration

### Which Layers Can Call It?
| Layer | mmx Access | Use Case |
|-------|-----------|----------|
| Orchestrator | `mmx_search` | Research domain before splitting features |
| Feature Agent | `mmx_search`, `mmx_text_chat` | Research APIs, generate boilerplate, look up docs |
| Worker | Same as Feature Agent | Direct tool execution |
| Critic | None | Keep critic fast and focused on local code review |

### Tool Implementation
- New module `src/mmx-tools.js` exports:
  - `MMX_TOOL_SCHEMAS`: OpenAI-compatible tool definitions for `mmx search` and `mmx text chat`
  - `MMX_TOOL_HANDLERS`: async functions that invoke `mmx` via `runCommandTool`
- These are injected into `runAgentTask` via `options.tools` and `options.toolHandlers`.

### Safety
- mmx tools are gated by `profile.tool_policy` (keys: `mmx_search`, `mmx_text_chat`).
- Default base profile does not include these keys → default is `deny`.
- Users must explicitly add `"mmx_search": "allow"` to their overlay profile.

---

## 5. Concrete Implementation

### New Modules

#### `src/orchestrator.js`
Core swarm engine. Exports:
- `runSwarm(root, prompt, options)` — entry point
- `planFeatures(root, config, prompt, options)` — Layer 1 planner
- `runFeatureAgent(root, feature, options)` — Layer 2 agent
- `runCritic(root, config, feature, workerResult, options)` — Critic LLM call
- `mergeResults(results)` — Aggregates `Promise.allSettled` output

#### `src/mmx-tools.js`
MiniMax tool wrappers. Exports:
- `MMX_TOOL_SCHEMAS`
- `MMX_TOOL_HANDLERS`

### Modified Modules

#### `src/agent.js`
- `runAgentTask` accepts `options.tools` (override default `TOOL_SCHEMAS`)
- `runAgentTask` accepts `options.toolHandlers` (map of custom tool executors)
- `executeTool` checks `options.toolHandlers` before throwing "Unknown tool"
- `TOOL_POLICY_KEYS` extended with `mmx_search` and `mmx_text_chat`

#### `bin/self-improve-cli.js`
- New top-level command: `sicli swarm <prompt> [flags]`
- Flags: `--plan-only`, `--concurrency <n>`, `--max-critic-iterations <n>`, `--yes`

### Data Flow

1. **Plan**: `runSwarm` calls `planFeatures` → LLM returns JSON feature list → persisted to `plan.json`
2. **Dispatch**: Features batched by `concurrency` (default 3) → `Promise.allSettled`
3. **Worker**: Each feature runs `runAgentTask` with autonomous mode + optional mmx tools
4. **Critic**: Post-worker, `runCritic` reviews the result via LLM
5. **Retry (optional)**: If critic rejects and iterations remain, worker resumes with feedback
6. **Synthesize**: Feature agent returns `{ feature, status, workerResult, criticResult }`
7. **Merge**: Orchestrator collects all feature results → `mergeResults` → persisted to `results.json`

---

## 6. CLI Command

### Usage

```bash
# Decompose and execute
sicli swarm "implement auth, logging, and caching layers"

# Preview plan without executing
sicli swarm --plan-only "add OAuth, rate limiting, and request logging"

# Control parallelism
sicli swarm --concurrency 5 "refactor all controllers"

# Allow more critic feedback loops
sicli swarm --max-critic-iterations 2 "implement payment flow"

# Auto-approve tools (non-interactive)
sicli swarm --yes "fix all lint errors"
```

### Output Format
JSON to stdout:

```json
{
  "runId": "swarm-1714291200000",
  "ok": true,
  "summary": "Features: 3 succeeded, 0 with warnings, 0 failed. Total: 3.",
  "successful": [
    {
      "feature": { "id": "auth", "title": "OAuth integration" },
      "status": "completed",
      "workerResult": {
        "text": "Added OAuth middleware...",
        "touchedFiles": ["src/auth.js", "src/middleware.js"]
      },
      "criticResult": { "approved": true, "feedback": "Looks correct." }
    }
  ],
  "warnings": [],
  "failed": []
}
```

---

## Module Boundaries

```
bin/self-improve-cli.js
  └─> src/orchestrator.js
       ├─> src/agent.js (runAgentTask for Worker)
       ├─> src/provider.js (chatCompletion for Critic + Planner)
       ├─> src/config.js (loadConfig)
       ├─> src/state.js (persist artifacts)
       └─> src/mmx-tools.js (optional extended tools)
            └─> src/tools.js (runCommandTool)
```

---

## Design Rationale

| Decision | Rationale |
|----------|-----------|
| In-process subagents | Keeps runtime small; no IPC/serialization overhead; fits Node.js async I/O model |
| `Promise.allSettled` | Failure isolation; one feature failure does not kill the swarm |
| File-based audit trail | No external DB; replayable; fits existing `.selfimprove/` state model |
| Critic as separate LLM call | Decouples generation from verification; allows focused review prompt |
| mmx as optional tool extensions | No hard dependency; profile-gated; easy to extend with more mmx commands |
| No automatic orchestrator retry | Prevents infinite loops; puts user in control |
| Concurrency limit (default 3) | Prevents provider rate limits and token budget explosion |

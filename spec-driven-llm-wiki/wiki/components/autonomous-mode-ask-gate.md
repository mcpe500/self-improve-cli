---
title: "Autonomous Mode & Ask Gate"
type: component
tags: [autonomous, ask-gate, deterministic, deferred]
last_updated: 2026-04-28
---

# Autonomous Mode & Ask Gate

`[[components/autonomous-mode-ask-gate]]` tracks deterministic and LLM-based question gating for autonomous agent mode.

## Responsibilities

- Validate all `ask_user` tool call arguments before processing via `validateAskUserArgs`.
- Apply deterministic policy (`deterministicPolicy`) without LLM calls for fast accept/reject/defer decisions.
- Reject questions matching `never_ask` patterns (e.g. "should I continue", "what's next").
- Reject high-risk blocking questions (`file_delete`, `command_exec`, `api_key`, etc.) and force safe default.
- Defer high-risk non-blocking questions to end-of-task report.
- Queue deferred questions in `DeferredQuestionsQueue` with budget cap (default 5).
- Format deferred questions as a human-readable report via `toReport()`.
- Escalate ambiguous questions to LLM review via `reviewQuestion` with fallback chain: mmx-cli shell-out then `chatCompletion`.
- Define canonical risk types: `clarification`, `file_write`, `file_delete`, `command_exec`, `external_dependency`, `api_key`, `permission`, `other`.

## Key Exports

- `RISK_TYPES` — `Set` of canonical risk type strings.
- `validateAskUserArgs(args)` — validates and normalizes `ask_user` arguments. Returns `{ question, reason, risk_type, files, safe_default, blocking }`. Throws on missing or invalid fields.
- `deterministicPolicy(candidate)` — returns `{ action, reason }` where action is `reject`, `defer`, `review`, or `approve`.
- `DeferredQuestionsQueue` — class with `push(q)`, `getAll()`, `hasBlocking()`, `isAtBudget()`, `toReport()`. Configurable `maxDeferred` (default 5).
- `reviewQuestion(root, config, originalPrompt, candidate, options)` — LLM-based review returning `{ approved, reason }`.

## Policy Decision Flow

1. Match against `NEVER_ASK_PATTERNS` regexes → `reject`.
2. If `risk_type` is in `REVIEW_IF_BLOCKING_TYPES` and `blocking` → `review`.
3. If `risk_type` is in `ALWAYS_REVIEW_TYPES` and `blocking` → `reject` (use safe_default).
4. If `risk_type` is in `ALWAYS_REVIEW_TYPES` and non-blocking → `defer`.
5. If non-blocking → `defer` (use safe_default, queue question).
6. Otherwise → `approve`.

## Constraints

- `safe_default` is always required; the agent must know what to do if rejected.
- `reviewQuestion` writes a temporary JSON messages file to `os.tmpdir()` for mmx-cli, cleaned up after use.
- mmx-cli review has a 15-second timeout and `windowsHide: true`.
- On both mmx-cli and `chatCompletion` failure, review defaults to `{ approved: false }`.
- `NEVER_ASK_PATTERNS` are regex-based and case-insensitive.
- Deferred queue is bounded; `isAtBudget()` returns true at `maxDeferred` limit.
- `reviewQuestion` strips `<think/>` blocks from LLM responses before JSON parsing.

## Related

- [[components/agent-chat-loop]]
- [[components/swarm-orchestrator]]
- [[components/provider-client]]
- [[components/mmx-tools]]

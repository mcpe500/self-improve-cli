---
title: "Deterministic Policy Before LLM Reviewer"
type: decision
tags: [ask-gate, performance, cost]
last_updated: 2026-04-28
---

# Deterministic Policy Before LLM Reviewer

## Decision

Run deterministic `never_ask` pattern matching before invoking an expensive LLM call to review whether the agent may ask the user a question.

## Rationale

- Most questions hit obvious `never_ask` patterns ("should I continue?", "should I run tests?") and can be rejected instantly.
- LLM calls cost tokens and latency; skipping them for clear-cut cases saves both.
- Only ambiguous permission+blocking cases escalate to the reviewer model.

## Constraints

- Reviewer fallback chain: `mmx-cli → chatCompletion → safe_default`.
- Deterministic policy must be conservative — only reject clear never-ask cases.
- High-risk actions (`file_delete`, `command_exec`, `api_key`) always block regardless of policy.

## Related

- [[patterns/deferred-questions]]
- [[components/autonomous-mode-ask-gate]]
- [[decisions/fallback-chain-pattern]]

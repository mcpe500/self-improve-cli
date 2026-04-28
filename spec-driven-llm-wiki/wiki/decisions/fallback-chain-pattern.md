---
title: "Fallback Chain Pattern"
type: decision
tags: [resilience, provider, architecture]
last_updated: 2026-04-28
---

# Fallback Chain Pattern

## Decision

Use 3-level fallback chains for all LLM-dependent features: `mmx-cli → chatCompletion → static rules`.

## Rationale

- Zero dep requirement — the system must run without installing external packages.
- Works without `mmx-cli` installed (falls back to direct API call).
- Works without any API key at all (falls back to static rule engine).
- Graceful degradation preserves core functionality in constrained environments.

## Constraints

- Quality degrades with each fallback level — static rules are blunt compared to LLM judgment.
- Fallback adds latency when earlier levels fail.
- Static rules must cover enough common cases to remain useful as last resort.

## Related

- [[patterns/fallback-chain]]
- [[components/self-improve-engine]]
- [[components/autonomous-mode-ask-gate]]
- [[components/provider-client]]

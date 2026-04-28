---
title: "Fallback Chain"
type: pattern
tags: [resilience, provider, error-handling]
last_updated: 2026-04-28
---

# Fallback Chain

`[[patterns/fallback-chain]]` describes a 3-level degradation strategy for LLM-dependent features.

## Pattern

Try providers in order: `mmx-cli` shell-out → `chatCompletion` direct API call → static rule engine. Each level catches failures from the previous and attempts the next.

```
try { return await mmxCli(prompt) }
catch { try { return await chatCompletion(prompt) }
catch { return staticRule(input) } }
```

## When To Use

- Any feature that requires LLM inference but must remain functional without an API key.
- Self-improve patch proposal, ask gate question review, profile critic evaluation.

## Implementation

1. Attempt `mmx-cli` shell-out (optional CLI tool, may not be installed).
2. On failure, attempt `chatCompletion` with configured provider (may lack API key).
3. On failure, apply deterministic static rules as safe default.
4. Log which level succeeded for diagnostics.

## Related

- [[decisions/fallback-chain-pattern]]
- [[components/self-improve-engine]]
- [[components/provider-client]]

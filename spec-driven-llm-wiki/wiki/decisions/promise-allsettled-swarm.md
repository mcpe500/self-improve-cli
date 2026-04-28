---
title: "Promise.allSettled for Swarm"
type: decision
tags: [swarm, resilience, concurrency]
last_updated: 2026-04-28
---

# Promise.allSettled for Swarm

## Decision

Use `Promise.allSettled` instead of `Promise.all` for parallel feature execution in swarm orchestration.

## Rationale

- One feature failure does not kill the entire swarm — other features complete independently.
- Results include `status` (`fulfilled`/`rejected`) and value/reason per feature.
- Orchestrator can report partial success and retry only failed features.
- Aligns with the principle that swarm features are independent work units.

## Constraints

- Failed features produce empty results but do not crash the orchestrator.
- Caller must inspect each settled result's status before consuming the value.
- Retries for failed features require separate orchestration logic.

## Related

- [[components/swarm-orchestrator]]
- [[decisions/in-process-subagents]]

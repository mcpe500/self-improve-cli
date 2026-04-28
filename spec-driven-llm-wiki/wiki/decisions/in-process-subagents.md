---
title: "In-Process Subagents"
type: decision
tags: [architecture, swarm, performance]
last_updated: 2026-04-28
---

# In-Process Subagents

## Decision

Use in-process async subagents instead of forked child processes for swarm orchestration.

## Rationale

- No IPC overhead — subagents share the same memory space as the orchestrator.
- LLM calls are async I/O, so a single Node event loop handles concurrency naturally.
- Shared memory avoids serialization cost for large profile/state objects.
- Fast context switch compared to process fork and message passing.

## Constraints

- Circular dependency between `agent.js` and `orchestrator.js` resolved via dynamic `require()` at call time rather than static imports.
- No true CPU parallelism — all subagents compete on the same event loop.
- A blocking call in one subagent stalls all others.

## Related

- [[decisions/promise-allsettled-swarm]]
- [[components/swarm-orchestrator]]
- [[components/agent-chat-loop]]

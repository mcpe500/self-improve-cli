---
title: "Project Overview"
type: synthesis
tags: [overview]
last_updated: 2026-04-28
---

# Project Overview

Self-improving coding CLI with agentic chat, swarm orchestration, autonomous mode, and spec-driven development memory.

## Current Known Scope

- Plain JavaScript, zero runtime dependencies, cross-platform (Linux/macOS/Windows).
- OpenAI-compatible chat completion with provider presets (OpenAI, MiniMax, Z.AI).
- Interactive chat REPL and one-shot mode with tool-calling agent loop.
- Autonomous mode with Don't Ask Gate: deterministic policy → LLM reviewer → deferred questions.
- Multi-agent swarm orchestrator: plan → parallel worker+critic → merge.
- Self-improve pipeline: trace → diagnose → propose patch → critic → sandbox eval → pareto → promote.
- Background daemon with HTTP API for continuous self-improvement.
- JSON audit trail in `.selfimprove/`, no external DB.
- Growth policy levels control profile patch surface.
- All LLM features optional; core CLI works without any API key.

## Active Components

- [[components/lightweight-cli-core]]
- [[components/agent-chat-loop]]
- [[components/swarm-orchestrator]]
- [[components/autonomous-mode-ask-gate]]
- [[components/mmx-tools]]
- [[components/provider-client]]
- [[components/config-manager]]
- [[components/profile-engine]]
- [[components/state-manager]]
- [[components/self-improve-engine]]
- [[components/daemon]]
- [[components/coding-tools]]
- [[components/secrets-storage]]

## Active Decisions

- [[decisions/plain-js-zero-dependency-mvp]]
- [[decisions/in-process-subagents]]
- [[decisions/deterministic-policy-before-reviewer]]
- [[decisions/fallback-chain-pattern]]
- [[decisions/json-audit-trail]]
- [[decisions/promise-allsettled-swarm]]

## Active Patterns

- [[patterns/fallback-chain]]
- [[patterns/worker-pool-sandbox]]
- [[patterns/pareto-frontier]]
- [[patterns/deferred-questions]]
- [[patterns/growth-gate]]

## Next Memory Updates

- Add streaming provider output when tool-call streaming is implemented.
- Add rollback snapshot pattern when profile rollback is implemented beyond audit logs.
- Add performance measurements once CLI grows beyond MVP.
- Add wiki pages for sandbox/worker_pool.js and Pareto implementation details.

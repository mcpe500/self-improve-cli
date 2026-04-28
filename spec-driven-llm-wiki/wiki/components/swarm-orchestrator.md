---
title: "Swarm Orchestrator"
type: component
tags: [swarm, orchestrator, parallel, critic]
last_updated: 2026-04-28
---

# Swarm Orchestrator

`[[components/swarm-orchestrator]]` tracks multi-feature parallel decomposition, worker execution, and critic review.

## Responsibilities

- Decompose user prompts into independent features via `planFeatures` using an LLM architect prompt.
- Execute features in parallel batches with configurable `concurrency` (default 3).
- Run a worker agent (`runAgentTask` from `[[components/agent-chat-loop]]`) for each feature.
- Apply a critic reviewer (`runCritic`) after each worker to evaluate correctness, safety, and completeness.
- Support critic retry loops: if the critic rejects, the worker gets a retry prompt with feedback (configurable via `maxCriticIterations`).
- Aggregate all feature results via `mergeResults`, classifying outcomes as `completed`, `completed_with_warnings`, or `failed`.
- Persist artifacts (plan, results) to `.selfimprove/swarm/<run-id>/` as JSON.
- Emit progress events throughout: `planning`, `planned`, `feature_start`, `worker_done`, `critic_review`, `batch_complete`, `swarm_done`.
- Support `planOnly` mode to decompose without executing.
- Optionally enable MMX tools (`mmx_search`, `mmx_text_chat`) in worker agents via `options.enableMmx`.

## Key Exports

- `runSwarm(root, prompt, options)` — full planning + execution pipeline. Returns `{ runId, prompt, merged, timestamp }`.
- `planFeatures(root, config, prompt, options)` — LLM feature decomposition. Returns array of `{ id, title, description, dependencies, estimated_effort }`.
- `runFeatureAgent(root, feature, options)` — worker + critic for a single feature. Returns `{ feature, status, workerResult, criticResult }`.
- `runCritic(root, config, feature, workerResult, options)` — LLM code review. Returns `{ approved, feedback, severity, suggested_fixes }`.
- `mergeResults(results)` — aggregates `Promise.allSettled` output into `{ ok, summary, successful, warnings, failed }`.

## Constraints

- Features run via `Promise.allSettled` so one failure does not kill the swarm.
- `planFeatures` requires valid JSON from the LLM; throws on parse failure.
- Worker agents run in autonomous mode with `maxTurns` from active profile or default 25.
- Critic retry is capped by `maxCriticIterations`; default 1 (no retry).
- Artifacts use `fs.mkdir({ recursive: true })` for swarm directory creation.
- `stripThinkBlocks` removes `<think/>` blocks from LLM responses before JSON parsing.
- `extractTouchedFiles` collects file paths from `write_file`, `edit_file`, and `read_file` tool calls in agent messages.
- `runFeatureAgent` uses dynamic `require('./agent')` to resolve circular dependency at call time.
- Supports `AbortSignal` propagation for cancellation.

## Related

- [[components/agent-chat-loop]]
- [[components/autonomous-mode-ask-gate]]
- [[components/provider-client]]
- [[components/mmx-tools]]

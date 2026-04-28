---
title: "Self-Improve Engine"
type: component
tags: [self-improve, diagnose, propose, critic, pareto]
last_updated: 2026-04-28
---

# Self-Improve Engine

`[[components/self-improve-engine]]` tracks the full self-improvement pipeline — diagnose failures, propose patches, critic review, sandbox evaluation, Pareto frontier, and background review.

## Responsibilities

- Diagnose failures via `diagnoseFailures(failures, recentPatches)` — fallback chain: mmx-cli shell-out, `chatCompletion` LLM call, then `staticDiagnoseFailures` regex patterns (max turns, shell redirection, missing context).
- Propose harness patches via `buildHarnessPatch(diagnosis)` — same fallback chain: mmx-cli, `chatCompletion`, then `staticBuildHarnessPatch` rule-based patches.
- Critic evaluation via `criticEvaluate(patch, harnessSpec, context)` — mmx-cli or `chatCompletion` reviewer approves or rejects patches with reasoning and suggested refinements.
- Sandbox evaluation via `sandboxEvaluateCandidate(root, patch, options)` — uses `WorkerPool` (worker_threads) to run benchmark tasks and failure replay traces against a patched profile; reports failure rate, token usage, and duration.
- Compute Pareto frontier via `computeParetoFrontier(candidates)` — filters dominated candidates where one is strictly better on both `failure_rate` and `context_cost`.
- Evaluate full frontier via `evaluateParetoFrontier(root)` — loads all candidate scores and applies Pareto filter.
- Learn from a single message via `learnFromMessage(root, message, options)` — appends event, suggests patch, evaluates growth gate, optionally applies and audits.
- Run demo self-improve via `runDemo(root)` — simulates a shell-redirection failure lesson.
- Record task traces via `recordTaskTrace(root, trace)` — appends structured trace with prompt, tools, duration.
- Background review via `runBackgroundReview(root, options)` — scans new traces since last optimizer run, extracts learning messages, proposes and evaluates patches per trace.
- Schedule background runs via `scheduleBackgroundReview(root)` — spawns detached child process when pending traces meet `self_improve_review_every` threshold.
- Parse LLM proposer output via `applyProposerOutput(rawOutput)` — tries direct JSON parse, code block extraction, brace match, array extract, and line-by-line regex fallback.
- Extract failure messages from traces via `traceFailureMessages(trace)` and `traceLearningMessages(trace)` — detects max-turn stops, tool errors, shell redirection, and user project context patterns.

## Pipeline Flow

```
traces.jsonl → diagnoseFailures → buildHarnessPatch → criticEvaluate
  → sandboxEvaluateCandidate → computeParetoFrontier → promoteCandidate
```

Background path: `scheduleBackgroundReview` → detached process → `runBackgroundReview` → per-trace `learnFromMessage`.

## Constraints

- Fallback chain ensures no single LLM dependency blocks the pipeline: mmx-cli → chatCompletion → static rules.
- Sandbox uses `WorkerPool` with configurable `poolSize` (default 4) and `timeoutMs` (default 120s).
- Patches touching protected fields (`/id`, `/version`, `/growth/level`, etc.) are rejected before LLM calls.
- Failed patches are recorded to optimizer state; recurring failures after patch trigger automatic rollback.
- Background review only runs when `config.self_improve_background` is true and pending traces meet the review threshold.
- All changes audited via `.selfimprove/patches.jsonl` append-only log.
- `callMmxProposer` and `callMmxCritic` use `execSync` with 30s timeout; failures silently fall back.

## Related

- [[components/state-manager]]
- [[components/profile-engine]]
- [[components/daemon]]
- [[components/lightweight-cli-core]]

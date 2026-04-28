---
title: "Deferred Questions Queue"
type: pattern
tags: [autonomous, ask-gate, ux]
last_updated: 2026-04-28
---

# Deferred Questions Queue

`[[patterns/deferred-questions]]` describes a budget-limited queue for non-blocking user questions in autonomous mode.

## Pattern

When the agent encounters a non-blocking question that cannot be auto-resolved, defer it to a capped queue. At task completion, present all deferred questions as a batch report rather than interrupting the workflow.

## When To Use

- Autonomous mode where the agent should continue working rather than wait for user input.
- Non-critical questions that have a reasonable `safe_default`.

## Implementation

1. `DeferredQuestionsQueue` with max capacity (default 5).
2. Non-blocking, low-risk questions are appended if under budget.
3. When at budget, auto-reject with `safe_default` instead of deferring.
4. `task_complete` flushes the queue and displays all deferred questions as a summary report.

## Related

- [[decisions/deterministic-policy-before-reviewer]]
- [[components/autonomous-mode-ask-gate]]

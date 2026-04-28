---
title: "Worker Pool Sandbox"
type: pattern
tags: [performance, sandbox, evaluation]
last_updated: 2026-04-28
---

# Worker Pool Sandbox

`[[patterns/worker-pool-sandbox]]` describes parallel benchmark simulation using Node.js worker threads.

## Pattern

Spawn a pool of `worker_threads` to evaluate patch candidates in isolation. Each worker receives a candidate, runs simulated benchmarks, and returns a score vector. Timeout kills stuck workers.

## When To Use

- Evaluating multiple self-improve patch candidates without blocking the main agent loop.
- Any scenario requiring parallel CPU-bound scoring of independent inputs.

## Implementation

1. Create `WorkerPool` with configurable concurrency (default matches CPU count).
2. Post each candidate to a worker with serialized profile + test harness.
3. Worker runs benchmark, returns score object via `parentPort`.
4. Timeout per worker (configurable ms) prevents hangs.
5. Collect all results, feed into Pareto frontier filter.

## Related

- [[patterns/pareto-frontier]]
- [[components/self-improve-engine]]
- [[decisions/in-process-subagents]]

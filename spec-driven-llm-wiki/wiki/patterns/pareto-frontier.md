---
title: "Pareto Frontier Filtering"
type: pattern
tags: [selection, optimization, evaluation]
last_updated: 2026-04-28
---

# Pareto Frontier Filtering

`[[patterns/pareto-frontier]]` describes a dominance-based filter for selecting among multiple candidates scored on several dimensions.

## Pattern

Given candidates each scored on multiple dimensions (e.g., speed, accuracy, token cost), keep only non-dominated candidates. A candidate A dominates B if A is ≥ B on every dimension and strictly greater on at least one.

## When To Use

- Multiple self-improve candidates with trade-offs across score dimensions.
- Any multi-objective selection where no single scalar captures quality.

## Implementation

1. Collect score vectors from worker pool sandbox evaluation.
2. For each candidate, check whether any other candidate dominates it on ALL dimensions.
3. Remove dominated candidates — remaining set is the Pareto frontier.
4. Auto-promote applies the best frontier candidate when criteria are met.

## Related

- [[patterns/worker-pool-sandbox]]
- [[components/self-improve-engine]]

# Project rules

## Goal
Improve the OpenCode wrapper around the model without changing the model itself.

## Improvement rules
- Prefer one focused change per iteration.
- Do not rewrite many moving parts at once.
- Keep historical run logs intact.
- Never hardcode benchmark answers or task-specific cheats.
- Prefer better retrieval, better verification, better prompts, and better rules over large repo edits.

## Reasoning behavior to optimize for
- Inspect before answering.
- Prefer evidence over guesswork.
- Use exploratory investigation when the task is ambiguous.
- Verify important claims with tests, traces, or files.
- Keep the final answer short and direct once confidence is high.
- Avoid repeated searches and repeated restating.

## Evaluation behavior
- Run lightweight checks before heavier ones.
- Treat tests and replay prompts as the main score.
- Do not claim improvement unless the score actually improved.

## Safety for self-improvement
- Never edit historical score files except to append new runs.
- Never delete old runs.
- Never trigger recursive self-improvement loops.

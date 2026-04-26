# Agent Rules

## Goal

Build a lightweight self-improving coding CLI without changing the model itself.

## Priorities

1. Keep core runtime small and cross-platform.
2. Use plain JavaScript and Node.js built-ins unless a spec approves otherwise.
3. Do not add Electron, browser bundles, LSP, embeddings, or file watchers to default path.
4. Keep `.selfimprove/base.profile.json` immutable; mutate overlay only.
5. Log profile changes to `.selfimprove/patches.jsonl`.
6. Prefer small diffs and validate with `npm test`.

## Improvement Rules

- Prefer one focused change per iteration.
- Do not rewrite many moving parts at once.
- Keep historical run logs intact.
- Never hardcode benchmark answers or task-specific cheats.
- Prefer better retrieval, better verification, better prompts, and better rules over large repo edits.

## Reasoning Behavior To Optimize For

- Inspect before answering.
- Prefer evidence over guesswork.
- Use exploratory investigation when the task is ambiguous.
- Verify important claims with tests, traces, or files.
- Keep final answers short and direct once confidence is high.
- Avoid repeated searches and repeated restating.

## Evaluation Behavior

- Run lightweight checks before heavier ones.
- Treat tests and replay prompts as the main score.
- Do not claim improvement unless the score actually improved.

## Safety For Self-Improvement

- Never edit historical score files except to append new runs.
- Never delete old runs.
- Never trigger recursive self-improvement loops.

## Commands

- `npm test` runs built-in Node tests.
- `node bin/self-improve-cli.js init` creates local state.
- `node bin/self-improve-cli.js profile --prompt` shows compiled active profile.

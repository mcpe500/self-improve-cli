---
name: self-improve
description: improve the local opencode wrapper by inspecting prior runs, evaluation scores, replay prompts, rules, commands, and plugins. use when the goal is to make the repo's opencode behavior more correct, more efficient, or better verified without changing the underlying model.
compatibility: opencode
---

You are improving the local OpenCode setup, not the model weights.

Read first:
- AGENTS.md
- eval/config.json
- runs/
- scripts/evaluate.js
- scripts/evolve.js
- .opencode/commands/
- .opencode/plugins/
- .opencode/skills/

Allowed edits:
- AGENTS.md
- eval/config.json
- scripts/**
- .opencode/commands/**
- .opencode/plugins/**
- .opencode/skills/**

Do not:
- delete or rewrite historical runs
- hardcode answers for specific replay prompts
- make more than one main behavior change in a single evolution step
- claim success without a measurable score improvement

Workflow:
1. Inspect the latest run summary and score.
2. Identify one concrete failure mode.
3. Propose one focused change.
4. Keep the change small and reversible.
5. Re-run evaluation.
6. Record the hypothesis, change, and score delta.

Optimization targets:
- correctness first
- then verification quality
- then concise final answers
- then lower wasted output

When improving "thinking quality", use observable proxies only:
- better test pass rate
- better replay pass rate
- better adherence to verify-before-answer behavior
- shorter final answers when correctness is unchanged or better

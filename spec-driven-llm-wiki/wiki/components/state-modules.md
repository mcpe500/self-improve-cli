---
title: "State Modules"
type: component
tags: [state, persistence, modularization]
last_updated: 2026-04-29
---

# State Modules

`[[components/state-modules]]` tracks the focused modules behind the `src/state.js` barrel export.

## Purpose

Keep `.selfimprove/` persistence responsibilities small and grouped by domain while preserving the public `require('./state')` interface.

## Location

- `src/state.js` — barrel re-export
- `src/state/common.js`
- `src/state/profile-state.js`
- `src/state/audit-log.js`
- `src/state/candidate-state.js`
- `src/state/daemon-state.js`

## Responsibilities

- `common.js`: state constants, `statePath`, `exists`, `readJson`, `writeJson`.
- `profile-state.js`: workspace init, profile loading/merging, overlay save/patch, growth level, MCP config, active skills.
- `audit-log.js`: append/read/count JSONL events, traces, and patch audits.
- `candidate-state.js`: optimizer state, self-improve status, rollback, candidates, harnesses, scores.
- `daemon-state.js`: daemon state JSON, PID file, running check.

## Interfaces

The public interface remains `src/state.js`, which re-exports all focused state functions.

## Dependencies

- [[components/profile-engine]]
- [[components/self-improve-engine]]
- [[components/daemon]]
- [[components/skills-system]]
- [[components/mcp-client]]

## Notes

- `profile-state.js` now imports `applyJsonPatch` directly from `json-utils`, fixing the prior implicit missing import in monolithic `state.js`.
- `initWorkspace` still creates base/overlay profiles, JSONL logs, and default MCP config to preserve previous behavior.
- This extraction keeps `.selfimprove/base.profile.json` immutable and mutates only overlay/state files.

---
title: "State Manager"
type: component
tags: [state, persistence, crud, jsonl]
last_updated: 2026-04-28
---

# State Manager

`[[components/state-manager]]` tracks all persistent state under `.selfimprove/` — profiles, event/trace/patch logs, candidates, optimizer state, and daemon lifecycle.

## Responsibilities

- Initialize workspace via `initWorkspace(root)` — creates `.selfimprove/`, copies `base.profile.json` from defaults, creates empty `overlay.profile.json`, and ensures JSONL log files exist.
- Load and merge profiles via `loadProfiles(root)` — reads base, applies defaults, deep-merges overlay, validates both base and active profiles.
- Save overlay with backup rotation via `saveOverlay(root, overlay)` — maintains `.bak.0`, `.bak.1`, `.bak.2` chain before overwriting.
- Append timestamped records: `appendEvent`, `appendTrace`, `appendPatchAudit` — each adds `ts` ISO field and appends one JSON line.
- Apply patches atomically via `applyPatchToOverlay(root, patch)` — writes to `.tmp` then renames over overlay.
- Manage growth level via `setGrowthLevel(root, level, options)`.
- Rollback via `rollbackToBackup(root)` or `rollbackToBackupFromNumber(root, n)`.
- Record failed patches to optimizer state via `recordFailedPatch(root, patch, reason)`.
- Candidate management: `nextCandidateId`, `writeCandidateHarness`, `writeCandidateScores`, `promoteCandidate`, `loadCandidateScores`, `listCandidates` — stores harness/scores under `.selfimprove/candidates/<id>/`.
- Daemon lifecycle: `readDaemonState`, `writeDaemonState`, `writeDaemonPid`, `readDaemonPid`, `clearDaemonPid`, `isDaemonRunning` — PID file and state JSON.
- Report status via `getSelfImproveStatus(root)` and `getStatus(root)` — counts, recent entries, growth config, and file paths.
- Read JSONL logs via `readAllJsonLines`, `readRecentJsonLines`, `countJsonLines` — with configurable limits.

## File Layout

```
.selfimprove/
├── base.profile.json      (immutable, copied from profiles/default.profile.json)
├── overlay.profile.json    (mutated by patches)
├── overlay.profile.json.bak.0/1/2
├── config.json
├── events.jsonl
├── patches.jsonl
├── traces.jsonl
├── optimizer.json
├── daemon.json
├── daemon.pid
├── secrets.json
└── candidates/
    └── <id>/
        ├── harness.json
        └── scores.json
```

## Constraints

- Base profile is never modified after `initWorkspace`; only overlay changes.
- JSONL files are append-only; never rewritten or truncated.
- Overlay backups rotate up to 3 levels (`.bak.0` through `.bak.2`).
- `readAllJsonLines` defaults to limit 10000 to prevent unbounded memory use.
- No external dependencies; uses `node:fs/promises` and `node:path` only.
- Cross-platform PID detection via `process.kill(pid, 0)` signal 0 check.

## Related

- [[components/profile-engine]]
- [[components/self-improve-engine]]
- [[components/daemon]]

---
title: "JSON Audit Trail No Database"
type: decision
tags: [state, storage, portability]
last_updated: 2026-04-28
---

# JSON Audit Trail No Database

## Decision

Use JSON and JSONL files for all persistent state — no external database.

## Rationale

- Replayable — every event, trace, and patch is a line in a log file.
- Portable — copy `.selfimprove/` directory to back up or migrate all state.
- Fits the `.selfimprove/` directory model with zero installation overhead.
- No runtime dependency on SQLite, LevelDB, or any storage engine.

## Constraints

- Not indexed — queries require linear scan of JSONL files.
- Append-only design means files grow unbounded without compaction.
- No concurrent write safety beyond Node's single-threaded event loop.
- Large trace files may slow down background review scans.

## Related

- [[components/state-manager]]
- [[decisions/plain-js-zero-dependency-mvp]]
- [[components/lightweight-cli-core]]

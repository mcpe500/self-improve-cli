---
title: "Plain JavaScript Zero-Dependency MVP"
type: decision
tags: [javascript, performance, portability]
last_updated: 2026-04-26
---

# Plain JavaScript Zero-Dependency MVP

## Decision

Use plain Node.js JavaScript for the first MVP instead of Rust/Go/TUI.

## Rationale

- Existing `README.md` already defines plain JavaScript and no platform-specific shell scripts as project goals.
- Node.js built-ins are enough for profile JSON, logs, file reads, search, and process spawning.
- Avoiding dependencies keeps install size and memory low compared with Electron/React TUI stacks.
- Rust can remain a future optimization path after behavior and self-improve semantics stabilize.

## Constraints

- No runtime npm dependencies.
- No full repository indexing by default.
- No LSP, embeddings, or file watchers by default.
- Use native filesystem APIs and `child_process.spawn` with `shell: false`.

## Related

- [[components/lightweight-cli-core]]
- [[001.lightweight-self-improve-cli-mvp]]

---
title: "Lightweight CLI Core"
type: component
tags: [cli, performance, self-improve]
last_updated: 2026-04-26
---

# Lightweight CLI Core

`[[components/lightweight-cli-core]]` tracks the parent project's zero-dependency CLI implementation.

## Responsibilities

- Load immutable base profile and mutable overlay profile.
- Validate supported growth levels: `none`, `low`, `medium`, `high`, `very_high`.
- Compile active profile into compact prompt text.
- Record events and patch audits under `.selfimprove/`.
- Provide basic coding tools without platform shell dependency.
- Support `[[components/agent-chat-loop]]` with profile prompt and tool policy.

## Performance Constraints

- No Electron.
- No bundled browser.
- No default repo-wide index.
- No runtime npm dependencies.
- File search scans on demand and excludes heavy directories.
- Command execution uses `spawn(..., { shell: false })`.

## Related

- [[decisions/plain-js-zero-dependency-mvp]]
- [[001.lightweight-self-improve-cli-mvp]]

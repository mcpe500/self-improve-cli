# self-improve-cli

A minimal, cross-platform starter repo for building a lightweight self-improving agentic coding CLI.

The MVP keeps model/provider work optional and improves the surrounding behavior first:
- JSON profile rules
- tool policy
- durable memory/lessons
- growth gates
- event and patch audit logs

## Design goals
- Plain JavaScript only
- No Bash, PowerShell, or AppleScript in the core loop
- Works on Linux, macOS, and Windows
- Manual by default
- Optional auto-apply only when profile growth policy allows it
- Low memory: no Electron, no default indexer, no LSP/embeddings/watchers by default

## What this measures

Current MVP validates profile behavior with built-in Node tests and records observed failures into `.selfimprove/events.jsonl`. Future evaluation/replay scoring can plug into the same event and patch logs.

## Files
- `AGENTS.md` project rules for agents working in this repo
- `bin/self-improve-cli.js` zero-dependency CLI entrypoint
- `src/profile.js` profile validation, prompt compilation, JSON patch, growth gates
- `src/state.js` `.selfimprove/` state, event log, patch audit, overlay mutation
- `src/tools.js` lightweight file read, search, and command tools
- `profiles/default.profile.json` immutable default profile template
- `test/profile.test.js` built-in Node tests
- `spec-driven-llm-wiki/` spec-driven project memory

## Manual use
From the repo root:

```bash
npm test
node bin/self-improve-cli.js init
node bin/self-improve-cli.js status
node bin/self-improve-cli.js profile --prompt
node bin/self-improve-cli.js improve --type failure --message "edited file without reading context first"
node bin/self-improve-cli.js improve --type failure --message "edited file without reading context first" --apply
```

Optional local install:

```bash
npm link
sicli status
```

## Growth policy

Active profile lives in `.selfimprove/base.profile.json` + `.selfimprove/overlay.profile.json`.

- `none`: no profile mutation
- `low`: propose only; human may apply safe patches
- `medium`: can auto-apply safe rule/memory patches when `auto_apply=true`
- `high`: can also patch style/tool policy
- `very_high`: broader patch surface, still protected from self-escalating growth level

Change local growth level:

```bash
node bin/self-improve-cli.js growth medium --auto-apply true
```

## Coding tools

```bash
node bin/self-improve-cli.js tool read README.md
node bin/self-improve-cli.js tool search profile .
node bin/self-improve-cli.js tool run npm test
```

`tool run` uses `child_process.spawn` with `shell: false`.

## Notes for Windows
This repo avoids platform-specific shell scripts and runs with Node.js on Windows, Linux, and macOS.

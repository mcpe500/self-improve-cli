---
title: "Daemon"
type: component
tags: [daemon, background, http, self-improve]
last_updated: 2026-04-29
---

# Daemon

`[[components/daemon]]` tracks the background self-improvement daemon with HTTP API.

## Responsibilities

- Run `runDaemonLoop(root, options)` as a detached background process that survives terminal close.
- Store PID in `.selfimprove/daemon.pid` via `[[components/state-manager]]`.
- Maintain event-driven loop: trigger evaluation on new trace failures detected by `getTraceCount`.
- Maintain interval-triggered loop: run `runSelfImprovePropose` every `intervalMinutes` (default 15).
- Auto-promote candidates when `autoPromote` is enabled and score meets `autoPromoteThreshold` (default 0.8).
- Track consecutive errors; trigger `gracefulShutdown` after 5 consecutive failures.
- Persist daemon state to `.selfimprove/daemon.json` with status, timestamps, and last result.
- Start the local API server through `[[components/daemon-api]]` and keep lifecycle/shutdown logic in `daemon.js`.

## HTTP API

Route handling lives in `src/daemon-api.js`.

- `GET /status` — current daemon state and PID.
- `GET /candidates` — list all improvement candidates with scores.
- `POST /trigger` — force evaluation on next loop iteration.
- `POST /stop` — graceful self-termination.
- Binds to `127.0.0.1:{port}` (default `3847`), CORS enabled.

## Constraints

- No external HTTP framework; uses Node.js built-in `http` module.
- Loop check interval is 60 seconds regardless of configured `intervalMinutes`.
- Daemon state is immutable history; writes merge into existing state.
- Graceful shutdown closes HTTP server, writes `stopped` status, clears PID file.
- No dependency added beyond `[[components/self-improve-engine]]` and `[[components/state-manager]]`.
- `/stop` is routed through an injected controller (`stop`, `gracefulShutdown`) so the API module does not own daemon globals.

## Related

- [[components/self-improve-engine]]
- [[components/state-manager]]
- [[components/daemon-api]]
- [[components/agent-chat-loop]]

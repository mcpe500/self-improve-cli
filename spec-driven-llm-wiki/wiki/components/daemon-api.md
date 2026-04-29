---
title: "Daemon API"
type: component
tags: [daemon, http, api]
last_updated: 2026-04-29
---

# Daemon API

`[[components/daemon-api]]` tracks the local HTTP API route handling extracted from `[[components/daemon]]`.

## Purpose

Keep HTTP routing separate from daemon loop scheduling and lifecycle management.

## Location

- `src/daemon-api.js`

## Responsibilities

- Create the Node built-in HTTP server via `createApiServer(root, port, controller)`.
- Serve `GET /status` with daemon state and PID.
- Serve `GET /candidates` with candidate IDs and scores when present.
- Serve `POST /trigger` by setting `triggered: true` in daemon state.
- Serve `POST /stop` by calling injected `controller.stop()` and `controller.gracefulShutdown()`.
- Return JSON errors for unknown routes or route failures.

## Interfaces

- `createApiServer(root, port, controller)`

## Dependencies

- [[components/state-manager]]
- [[components/state-modules]]
- [[components/daemon]]

## Notes

- The server still binds to `127.0.0.1:{port}` and sets permissive local CORS headers.
- The injected controller avoids making the API module own daemon lifecycle state.

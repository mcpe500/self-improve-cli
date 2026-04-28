---
title: "MCP Transport"
type: component
status: active
---

# MCP Transport

## Purpose
JSON-RPC 2.0 transport layer for MCP protocol — stdio subprocess and HTTP.

## Location
`src/mcp-transport.js`

## Dependencies
- Node.js built-ins: child_process, http, https, events

## Interfaces
- `StdioTransport` — spawn child, Content-Length framing, pending request map
- `HTTPTransport` — HTTP POST + optional SSE, env var interpolation
- `interpolateEnv(obj)` — replace ${VAR} in string/object values

## Notes
- No external dependencies
- Content-Length state machine parser for stdio
- AbortController-based timeout on all transports
- Both emit: connected, disconnected, error events

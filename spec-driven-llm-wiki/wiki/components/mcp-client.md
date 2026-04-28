---
title: "MCP Client"
type: component
status: active
---

# MCP Client

## Purpose
MCP protocol client lifecycle and multi-server manager with tool bridge to OpenAI function-calling format.

## Location
`src/mcp-client.js`

## Dependencies
- [[mcp-transport]]

## Interfaces
- `MCPClient` — initialize, listTools, callTool, getToolSchemas, shutdown
- `MCPManager` — discover (parallel init), shutdown, connectServer, disconnectServer
- `convertInputSchema(inputSchema)` — MCP schema → OpenAI parameters
- `buildMcpToolBridge(mcpManager)` — returns { mcpToolSchemas, mcpToolHandlers }

## Notes
- Tool naming: `mcp__<server>__<tool>` prefix
- Policy: per-server toolPolicy → defaults → "ask"
- Tool description prefixed with `[MCP:<server>]`
- Promise.allSettled for parallel server init
- convertInputSchema strips defaults, adds additionalProperties:false

---
title: "MMX Tools"
type: component
tags: [mmx, minimax, tools, search, chat]
last_updated: 2026-04-28
---

# MMX Tools

`[[components/mmx-tools]]` tracks MiniMax mmx-cli integration exposing web search and text chat as agent-callable tools.

## Responsibilities

- Define tool schemas (`MMX_TOOL_SCHEMAS`) compatible with OpenAI function-calling format for two tools: `mmx_search` and `mmx_text_chat`.
- Implement tool handlers (`MMX_TOOL_HANDLERS`) that delegate to mmx-cli via `runCommandTool` with `shell: false`.
- Provide web search capability through `mmx_search` (queries mmx-cli `search query` command).
- Provide text generation capability through `mmx_text_chat` (queries mmx-cli `text chat` command with optional system prompt).
- Output JSON from both tools via `--output json --quiet` mmx-cli flags.

## Tool Schemas

- `mmx_search` — parameters: `query` (string, required). Executes `mmx search query --q <query> --output json --quiet`.
- `mmx_text_chat` — parameters: `message` (string, required), `system` (string, optional). Executes `mmx text chat --message user:<message> [--system <system>] --output json --quiet`.

## Key Exports

- `MMX_TOOL_SCHEMAS` — array of two OpenAI function-calling tool definitions.
- `MMX_TOOL_HANDLERS` — object mapping tool names to async handler functions: `{ mmx_search: executeMmxSearch, mmx_text_chat: executeMmxTextChat }`.

## Constraints

- Requires mmx-cli to be installed and accessible in PATH (invoked as `mmx` via `runCommandTool`).
- Uses `runCommandTool` from `[[components/lightweight-cli-core]]` which spawns with `shell: false` — no shell features available.
- Both tools pass `options.signal` through to `runCommandTool` for abort support.
- No direct API calls; all interaction goes through mmx-cli subprocess.
- Tool schemas set `additionalProperties: false` to enforce strict parameter validation.
- `system` prompt in `mmx_text_chat` is optional; omitted from CLI args when not provided.

## Related

- [[components/agent-chat-loop]]
- [[components/swarm-orchestrator]]
- [[components/provider-client]]

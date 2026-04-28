---
title: "Coding Tools"
type: component
tags: [tools, file, search, spawn, shell]
last_updated: 2026-04-28
---

# Coding Tools

`[[components/coding-tools]]` tracks the sandboxed file and command tools for the agent loop.

## Responsibilities

- `readFileTool(root, target, { limit })` — read UTF-8 file content, capped at 128 KB (`DEFAULT_READ_LIMIT`), returns `{ path, truncated, content }`.
- `writeFileTool(root, target, content, { overwrite })` — create or overwrite file; creates parent directories; rejects if `overwrite=false` and file exists.
- `editFileTool(root, target, oldText, newText)` — exact unique text replacement; fails if `oldText` not found or not unique in file.
- `searchTool(root, pattern, dir, { limit, readLimit })` — literal substring search across workspace files; skips `HEAVY_DIRS` (`node_modules`, `.git`, etc.); returns up to 100 matches (`DEFAULT_MATCH_LIMIT`).
- `runCommandTool(root, command, args, { timeoutMs })` — `spawn` with `shell: false`; captures stdout/stderr capped at 256 KB; kills after `timeoutMs` (default 120s).
- `resolveInside(root, target)` — resolve path within workspace root; throws if path escapes via `..` traversal.

## Constraints

- All file paths are resolved relative to workspace root; path traversal is blocked.
- `run_command` uses `spawn` with `shell: false`: no redirection, pipes, heredocs, shell builtins, or compound commands.
- `windowsHide: true` suppresses console windows on Windows.
- All tools accept an optional `AbortSignal` for cancellation.
- Search skips binary files (contains null bytes).
- Skips `HEAVY_DIRS` directories during recursive walk (from `[[components/profile-engine]]`).
- No dependency added.

## Related

- [[components/agent-chat-loop]]
- [[components/lightweight-cli-core]]
- [[components/profile-engine]]

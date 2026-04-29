---
title: "Tool Safety"
type: component
tags: [safety, permissions, tools, git]
last_updated: 2026-04-29
---

# Tool Safety

`[[components/tool-safety]]` tracks permission-mode enforcement and local tool safety checks extracted from `[[components/agent-chat-loop]]`.

## Purpose

Centralize approval, AI review, and git-reversibility checks before local coding tools execute.

## Location

- `src/safety/tool-safety.js`

## Responsibilities

- Map tool names to profile policy keys through `TOOL_POLICY_KEYS`.
- Enforce profile tool policies (`allow`, `ask`, `deny`) and config permission modes.
- Ask for approval in `secure` mode and when `partial_secure` cannot prove a file action is git-reversible.
- Allow read/search without approval in `partial_secure` and `ai_reviewed` modes.
- Detect git-reversible file actions via `git rev-parse`, `git status --porcelain`, and `git ls-files`.
- Run clean-context AI safety review for action tools in `ai_reviewed` mode.

## Interfaces

- `ensureAllowed(root, profile, config, name, args, options)`
- `reviewToolSafety(root, config, name, args, signal)`
- `isGitReversibleFileAction(root, name, args)`
- `askToolPermission(name, args, options, reason)`
- `fileTargetForTool(name, args)`

## Dependencies

- [[components/provider-client]]
- [[components/coding-tools]]
- [[components/chat-commands]]
- [[components/config-manager]]

## Notes

- `agent.js` imports `ensureAllowed` before dispatching tool calls.
- `agent.js` re-exports `isGitReversibleFileAction` for compatibility with existing tests/imports.
- The AI reviewer receives only the tool name, compact args, and safety rules, not the full chat context.

---
title: "Agent Chat Loop"
type: component
tags: [chat, provider, tools, agent]
last_updated: 2026-04-29
---

# Agent Chat Loop

`[[components/agent-chat-loop]]` tracks the agent execution loop, built-in tool schemas, tool-call dispatch, autonomous-mode behavior, and task trace recording.

## Responsibilities

- Run one-shot tasks through `runAgentTask(root, prompt, options)`.
- Load active profile from `[[components/lightweight-cli-core]]` and provider config from `[[components/config-manager]]`.
- Build the system prompt with workspace context and active skill instructions.
- Call OpenAI-compatible Chat Completions through `[[components/provider-client]]`.
- Expose local tools as function-call schemas.
- Delegate profile tool policy and permission-mode checks to `[[components/tool-safety]]`.
- Merge MCP and skill tool schemas/handlers into each agent run.
- Handle autonomous-mode tools: `ask_user`, `task_complete`, and `delegate_swarm`.
- Record task traces to `.selfimprove/traces.jsonl` and schedule background review.

## Tools

- `read_file`: capped UTF-8 file read.
- `search`: literal workspace search, skipping heavy directories.
- `run_command`: `spawn` with `shell: false`; no shell redirection/pipes/heredocs.
- `write_file`: direct UTF-8 file creation/overwrite.
- `edit_file`: exact unique text replacement.
- `ask_user`: Don't Ask Gate candidate in autonomous mode.
- `task_complete`: explicit autonomous completion declaration.
- `delegate_swarm`: autonomous delegation to `[[components/swarm-orchestrator]]`.

## Provider Presets

- OpenAI Compatible: `https://api.openai.com/v1`, `OPENAI_API_KEY`, models `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1`.
- MiniMax Coding Plan: `https://api.minimax.io/v1`, `MINIMAX_API_KEY`, models `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`.
- Z.AI Coding Plan: `https://api.z.ai/api/coding/paas/v4`, `ZAI_API_KEY`, models `GLM-5.1`, `GLM-5`, `GLM-5-Turbo`, `GLM-4.7`, `GLM-4.5-air`.

## Constraints

- API keys stored only in `.selfimprove/secrets.json`, not config.
- Secret file uses best-effort permissions: directory `0700`, file `0600`.
- No dependency added.
- No TUI, watcher, indexer, LSP, or embeddings.
- Slash commands and the interactive REPL live in `[[components/chat-commands]]`.
- Tool approvals and safety review live in `[[components/tool-safety]]`.
- Tool failures and max-turn stops are logged into `.selfimprove/events.jsonl` and `.selfimprove/patches.jsonl` for self-improvement.
- Chat task traces are appended to `.selfimprove/traces.jsonl`; background reviewer scans new traces without blocking chat.
- `startChat(root, options)` remains exported for compatibility and delegates to `chat-commands.startChat` with `runAgentTask` injected.

## Related

- [[components/lightweight-cli-core]]
- [[components/chat-commands]]
- [[components/tool-safety]]
- [[components/mcp-client]]
- [[components/skills-system]]
- [[002.interactive-agent-chat-cli]]

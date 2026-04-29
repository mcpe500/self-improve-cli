---
title: "Chat Commands"
type: component
tags: [chat, commands, repl, slash-commands]
last_updated: 2026-04-29
---

# Chat Commands

`[[components/chat-commands]]` tracks interactive chat REPL handling and local slash command dispatch extracted from `[[components/agent-chat-loop]]`.

## Purpose

Keep CLI/chat interaction concerns separate from the agent execution loop.

## Location

- `src/commands/chat-commands.js`

## Responsibilities

- Start the interactive chat REPL via `startChat(root, options, { runAgentTask })`.
- Dispatch slash commands through `handleSlashCommand(root, prompt, rl)`.
- Manage provider/model/key/config commands: `/connect`, `/models`, `/key`, `/config`.
- Manage permission and self-improve commands: `/permissions`, `/self-improve`.
- Manage orchestration and extension commands: `/swarm`, `/mcp`, `/skills`.
- Keep chat history in memory and pass it to the injected `runAgentTask` function.
- Handle ESC cancellation by aborting the current task controller.

## Interfaces

- `startChat(root, options, deps)`
- `handleSlashCommand(root, prompt, rl)`
- `handleConnectCommand(root, arg, rl)`
- `handleModelsCommand(root, arg, rl)`
- `handlePermissionsCommand(root, arg)`
- `handleSelfImproveCommand(root, arg)`
- `handleSwarmCommand(root, prompt, rl)`
- `handleMCPCommand(root, arg)`
- `handleSkillsCommand(root, arg)`
- `askApproval(question, rl)`

## Dependencies

- [[components/config-manager]]
- [[components/secrets-storage]]
- [[components/self-improve-engine]]
- [[components/mcp-client]]
- [[components/skills-system]]
- [[components/swarm-orchestrator]]

## Notes

- `startChat` receives `runAgentTask` through dependency injection so this module does not need to import the agent loop.
- `/swarm` still loads the orchestrator at command time and passes interactive progress callbacks.
- Hidden key input uses raw TTY mode when available and falls back to visible input otherwise.

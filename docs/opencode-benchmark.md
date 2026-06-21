# OpenCode Benchmark: Comprehensive DX Audit & Gap Analysis

**Purpose**: Understand why OpenCode feels good to developers, then systematically bring that quality to self-improve-cli.

**Last Updated**: 2026-06-21

---

## Executive Summary

OpenCode is a terminal-first agentic coding environment that feels "right" because it combines:
- **Developer-native design**: Terminal-first, keyboard-driven, composable
- **Clear mental model**: Plan/Build modes, permission layers, agent types
- **Reversibility**: Git snapshots, undo/redo, session management
- **Flexibility**: 75+ providers, custom commands, plugins, MCP
- **Professional UX**: Status clarity, feature discoverability, workflow-focused docs

This document audits OpenCode comprehensively and maps every feature to self-improve-cli's current state and implementation plan.

---

## Part 1: Why OpenCode DX Feels Good

### 1.1 UI That Informs

**Status is Always Clear**
- Header shows: app name, cwd, git branch, provider, model, mode (Plan/Build), permission level
- User never wonders "what mode am I in?" or "what provider is active?"
- Working directory visible means you always know context
- Git branch visible means you always know codebase state

**Visual Hierarchy**
- Main transcript panel for conversation
- Side panels for tools, events, status
- Footer shortcuts remind you of keybindings
- Modal dialogs for focused tasks (provider picker, config editor)

**Terminal-Native Aesthetics**
- No attempt to be a GUI — embraces terminal constraints
- ASCII art, borders, colors used thoughtfully
- Mouse support where it helps, keyboard-first always
- Feels like vim/tmux, not like a web app ported to terminal

### 1.2 UX That Guides

**Progressive Disclosure**
- `opencode` opens TUI immediately (no setup needed)
- `/connect` for provider (interactive picker)
- `/models` for model selection (with descriptions)
- `/init` generates AGENTS.md (project memory)
- Features discoverable via `/` command palette

**Plan Before Action**
- Plan mode: read-only, analyze, propose (safe to explore)
- Build mode: implement, edit, run (requires permission)
- Tab to switch modes (keyboard muscle memory)
- Agent respects mode constraints (Plan won't accidentally edit)

**Workflow-First Design**
```
User prompt
  ↓
AGENTS.md (project rules) + session context
  ↓
Agent decides: read/search/edit/bash/MCP/skill
  ↓
Tool results feed back to context
  ↓
Git snapshot (undo/redo available)
  ↓
Session saved (resume later)
```

### 1.3 DX That Scales

**From Solo Dev to Team**
- Local config: `~/.config/opencode/config.json`
- Project config: `.opencode/config.json` (commit to repo)
- Custom commands: `.opencode/commands/*.md` (share with team)
- AGENTS.md: project rules (share with team)
- Permissions: granular control (security for teams)

**From Simple to Complex**
- Simple: `opencode` → ask question → get answer
- Medium: `/connect openai` → `opencode "fix the bug"` → approve changes
- Advanced: custom commands + MCP + plugins + LSP + custom agents

**From Terminal to Everything**
- Terminal TUI: primary experience
- IDE extension: VS Code, Cursor integration
- ACP protocol: Zed, JetBrains, Neovim clients
- Web UI: browser-based interface
- Server/API: headless mode for automation
- SDK: TypeScript/JavaScript programmatic access

---

## Part 2: Complete OpenCode Feature List

### 2.1 Core Interfaces

| Feature | Description | Priority |
|---------|-------------|----------|
| Terminal TUI | Native terminal UI with blessed-like library | P0 |
| Web UI | Browser-based interface via `opencode web` | P2 |
| IDE Extension | VS Code, Cursor integration | P2 |
| ACP Protocol | JSON-RPC over stdio for editor clients | P2 |
| Server/API | Headless mode via `opencode serve` | P1 |
| SDK | TypeScript/JavaScript client library | P2 |

### 2.2 TUI Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Header with full status | App, cwd, git branch, provider, model, mode, permission | P0 |
| Scrollable transcript | Chat history with smooth scrolling | P0 |
| Multi-line input | Support for long prompts | P0 |
| Command history | ↑/↓ arrow navigation | ✅ Done |
| Tab completion | Auto-complete slash commands | ✅ Done |
| Command palette | `/` opens filterable command list | P0 |
| Status bar | Footer with keyboard shortcuts | ✅ Done |
| Modal dialogs | Provider picker, config editor, etc | P0 |
| Tool/event panel | Show tool calls and results | P1 |
| Loading indicators | Visual feedback during agent work | P0 |
| Permission prompts | Clear UI for allow/ask/deny | P0 |
| Mode indicator | Clear Plan/Build mode display | P0 |
| Theme system | Multiple color schemes | ✅ Done |
| Mouse support | Click to focus/select | ✅ Done |
| Keybind customization | Override default shortcuts | P2 |
| `!command` execution | Run shell commands from TUI | P0 |
| `@file` reference | Attach file content to prompt | P1 |
| `@agent` mention | Direct message to specific agent | P2 |
| Session navigation | Switch between sessions | P1 |
| Undo/redo | Git-based change reversal | P1 |

### 2.3 Agents & Modes

| Feature | Description | Priority |
|---------|-------------|----------|
| Build mode | Implementation agent (can edit/run) | P0 |
| Plan mode | Analysis agent (read-only) | P0 |
| Mode switcher | Tab to toggle Plan/Build | P0 |
| Agent registry | Define custom agents with prompts/models | P1 |
| Subagents | General, Explore, Scout (read-only) | P1 |
| Agent picker | Switch agents via UI | P1 |
| Agent permissions | Per-agent tool access control | P1 |
| Mention agents | `@agent` to route messages | P2 |
| System agents | Compaction, title, summary (internal) | P2 |

### 2.4 Providers & Models

| Feature | Description | Priority |
|---------|-------------|----------|
| Provider registry | 75+ providers (OpenAI, Anthropic, Gemini, etc) | P0 |
| Local models | Ollama, LM Studio, vLLM support | ✅ Done |
| Custom providers | OpenAI-compatible endpoints | ✅ Done |
| Provider picker | Interactive UI to select provider | P0 |
| Model picker | Interactive UI to select model | P0 |
| Provider test | Test connection before using | ✅ Done |
| Credential separation | API keys not in config.json | ✅ Done |
| Provider switch | Change provider via UI/command | ✅ Done |
| Model switch | Change model via UI/command | ✅ Done |
| Missing API key warning | Clear error when key not set | P0 |

### 2.5 Configuration

| Feature | Description | Priority |
|---------|-------------|----------|
| Global config | `~/.config/opencode/config.json` | ✅ Done |
| Local config | `.opencode/config.json` | ✅ Done |
| Config layering | Local > global > env > defaults | ✅ Done |
| Config validation | Check config before using | ✅ Done |
| Config backup | `.bak` before changes | ✅ Done |
| Config edit | Open config in editor | P1 |
| JSON/JSONC support | Comments in config | P2 |
| Managed config | Enterprise/organization settings | P2 |
| Config picker UI | Browse/edit config in TUI | P1 |

### 2.6 Commands

| Feature | Description | Priority |
|---------|-------------|----------|
| Slash commands | `/help`, `/exit`, `/status`, etc | ✅ Done |
| Command palette | Filterable list with descriptions | P0 |
| Custom commands | Markdown-based user commands | P1 |
| Command frontmatter | Description, agent, model metadata | P1 |
| `$ARGUMENTS` placeholder | Pass args to custom commands | P1 |
| `$1`, `$2` positional args | Positional parameters | P1 |
| `@file` reference | Attach file to command | P1 |
| `!command` injection | Run shell and inject output | P0 |
| Command discovery | `/` shows all available commands | P0 |
| Command autocomplete | Tab to complete command name | ✅ Done |

### 2.7 Permissions & Safety

| Feature | Description | Priority |
|---------|-------------|----------|
| Permission modes | secure, partial_secure, ai_reviewed, auto_approve | ✅ Done |
| Per-tool permissions | allow/ask/deny per tool | P0 |
| Permission UI | Clear prompts for approval | P0 |
| Wildcard permissions | `mcp.*` for all MCP tools | P1 |
| Agent permissions | Per-agent tool access | P1 |
| Permission explanation | Tell user what each mode does | P0 |
| Don't-ask gate | Autonomous mode with safety checks | ✅ Done |
| Deferred questions | Queue questions for later | ✅ Done |

### 2.8 Tools

| Feature | Description | Priority |
|---------|-------------|----------|
| read | Read file/range | ✅ Done |
| write | Create/overwrite file | ✅ Done |
| edit | Edit with exact replacement | ✅ Done |
| search | Regex search | ✅ Done |
| run_command | Execute shell command (shell=false) | ✅ Done |
| webfetch | Fetch web content | P2 |
| websearch | Search web | P2 |
| todowrite | Maintain task list | P1 |
| skill | Load SKILL.md on demand | ✅ Done |
| question | Ask user with choices | ✅ Done |
| lsp | Definitions, references, hover, diagnostics | P2 |
| apply_patch | Apply patch to file | P1 |
| custom tools | User-defined tools | P2 |
| MCP tools | Tools from MCP servers | ✅ Done |

### 2.9 MCP (Model Context Protocol)

| Feature | Description | Priority |
|---------|-------------|----------|
| MCP servers | Local and remote MCP support | ✅ Done |
| MCP add/remove | Manage servers via CLI/TUI | ✅ Done |
| MCP reload | Reload MCP configuration | ✅ Done |
| MCP tools list | Show available MCP tools | P1 |
| MCP permissions | Control MCP tool access | P1 |
| MCP OAuth | Auth flow for OAuth servers | P2 |
| MCP debug | Debug MCP server issues | P2 |

### 2.10 Skills

| Feature | Description | Priority |
|---------|-------------|----------|
| Skills discovery | Auto-discover SKILL.md files | ✅ Done |
| Skills enable/disable | Toggle skills | ✅ Done |
| Skills picker UI | Browse skills in TUI | ✅ Done |
| Skills metadata | Name, description, compatibility | ✅ Done |
| Global skills | `~/.config/opencode/skills/` | P1 |
| Project skills | `.opencode/skills/` | ✅ Done |
| Skill loading | Load SKILL.md on demand | ✅ Done |

### 2.11 Sessions

| Feature | Description | Priority |
|---------|-------------|----------|
| Session creation | New session per conversation | P1 |
| Session list | View all sessions | P1 |
| Session resume | Continue previous session | P1 |
| Session export | Export to markdown | P1 |
| Session share | Share via public link | P2 |
| Session delete | Remove old sessions | P1 |
| Session navigation | Switch sessions in TUI | P1 |
| Session history | Transcript saved | P1 |

### 2.12 Custom Agents

| Feature | Description | Priority |
|---------|-------------|----------|
| Agent config | Define agent in config.json | P1 |
| Agent prompt | Custom system prompt | P1 |
| Agent model | Agent-specific model | P1 |
| Agent permissions | Agent-specific tool access | P1 |
| Agent picker | Switch agents via UI | P1 |
| Built-in agents | Plan, Build, Explore, Scout | P1 |

### 2.13 Diagnostics

| Feature | Description | Priority |
|---------|-------------|----------|
| Test output panel | Show npm test results | P1 |
| Lint errors panel | Show eslint/tsc errors | P2 |
| Diagnostics in context | Feed errors to agent | P1 |
| LSP integration | Semantic code intelligence | P2 |
| Custom diagnostics | User-defined checks | P2 |

### 2.14 Plugins & Hooks

| Feature | Description | Priority |
|---------|-------------|----------|
| Plugin system | JS/TS extensions | P2 |
| Event hooks | before_tool, after_tool, etc | P1 |
| Plugin config | Enable/disable plugins | P2 |
| Community plugins | Discover shared plugins | P2 |
| Plugin API | Documented hook API | P2 |

### 2.15 Git Integration

| Feature | Description | Priority |
|---------|-------------|----------|
| Git branch display | Show current branch in header | P0 |
| Git snapshot | Snapshot before changes | P1 |
| Undo | Revert last change | P1 |
| Redo | Re-apply reverted change | P1 |
| Git status | Show modified files | P2 |

### 2.16 Server/API Mode

| Feature | Description | Priority |
|---------|-------------|----------|
| Serve command | `opencode serve` | P1 |
| HTTP API | REST endpoints | ✅ Partial |
| WebSocket | Real-time events | P2 |
| Client libraries | SDK for API access | P2 |

### 2.17 Documentation

| Feature | Description | Priority |
|---------|-------------|----------|
| Workflow-focused | Teach workflows, not just commands | P0 |
| Quick start | 60-second setup | ✅ Done |
| Examples | Real-world use cases | P1 |
| Troubleshooting | Common issues and fixes | P1 |
| Feature discoverability | `/` command palette helps | P0 |

---

## Part 3: OpenCode Feature Mapping

### Legend
- ✅ = Already implemented
- 🟡 = Partially implemented
- ❌ = Not implemented
- 📋 = Planned

### 3.1 P0 Features (Must Have)

| OpenCode Feature | Why It Matters | Current Status | Gap | Implementation Plan | Risk | Test Needed |
|------------------|----------------|----------------|-----|---------------------|------|-------------|
| **TUI header with full status** | User always knows context | 🟡 Shows provider/model, missing mode/permission/git | Missing mode indicator, permission level, git branch | Enhance TUI header to show: app, cwd, git branch, provider, model, mode (Plan/Build), permission level | Low | Test header displays all status items |
| **Plan/Build modes** | Safe exploration before implementation | ❌ None | No mode system at all | Create `src/modes.js` with plan/build states, integrate with agent permissions | Medium | Test mode switching, permission enforcement |
| **Command palette `/`** | Feature discovery | 🟡 Has slash commands but no palette UI | No filterable command list UI | Add command palette modal in TUI, list all commands with descriptions | Low | Test palette opens, filters, executes commands |
| **Provider/model picker** | Easy provider switching | 🟡 Has provider menu (F2) but no dedicated picker | No quick Ctrl+P picker | Add Ctrl+P shortcut for provider picker modal | Low | Test picker opens, selects, switches |
| **Config local/global** | Project vs user settings | ✅ Done | None | Already implemented with layering | Low | Test priority resolution |
| **Permission UX** | Clear approval prompts | 🟡 Has permission modes but no clear UI | No permission explanation panel | Add permission panel showing current mode and what it allows | Low | Test permission display |
| **`!command` execution** | Run shell from TUI | ❌ None | No shell command prefix | Add `!` prefix handler to run shell commands via existing tools | Low | Test `!git status` runs correctly |
| **Loading indicators** | Visual feedback | ❌ None | No loading spinner/progress | Add spinner during agent work, tool execution | Low | Test spinner shows/hides |
| **Mode indicator** | Clear Plan/Build display | ❌ None | No mode indicator | Add mode badge in header (PLAN/BUILD) | Low | Test mode badge updates |
| **Git branch display** | Know codebase state | ❌ None | No git branch in header | Add git branch to header (read from `.git/HEAD`) | Low | Test branch display |
| **Missing API key warning** | Clear error | 🟡 Has error but not prominent | Error not prominent enough | Enhance error display when API key missing | Low | Test error message clarity |
| **Backward compat** | Don't break existing | ✅ All 122 tests pass | None | Maintain all existing commands | Low | Run full test suite |

### 3.2 P1 Features (Should Have)

| OpenCode Feature | Why It Matters | Current Status | Gap | Implementation Plan | Risk | Test Needed |
|------------------|----------------|----------------|-----|---------------------|------|-------------|
| **Custom commands (markdown)** | User-defined workflows | ❌ None | No markdown command system | Create `src/commands/custom-commands.js` to parse `.selfimprove/commands/*.md` | Medium | Test command parsing, execution |
| **Sessions management** | Resume conversations | ❌ None | No session tracking | Create `src/sessions/` with create/list/resume/export | Medium | Test session CRUD |
| **Agent registry** | Custom agents | ❌ None | No agent system | Create `src/agents/` with registry, config, picker | Medium | Test agent definition, switching |
| **Tool/event panel** | See tool calls | ❌ None | No tool visibility | Add side panel showing tool calls and results | Medium | Test panel updates |
| **Diagnostics panel** | See errors | ❌ None | No diagnostics | Add panel for test/lint output | Medium | Test panel displays errors |
| **MCP tools list** | See available tools | 🟡 Has MCP but no tools list | No tools visibility | Add MCP tools display | Low | Test tools list |
| **Skills detail UI** | Understand skills | 🟡 Has skills menu but limited detail | No skill descriptions | Enhance skills menu with descriptions | Low | Test skill details |
| **Plugin hooks** | Extensibility | ❌ None | No hook system | Create minimal hook loader | Medium | Test hooks execute |
| **Undo/redo** | Reversibility | ❌ None | No git snapshot | Add git snapshot before changes, undo/redo commands | High | Test undo/redo works |
| **@file reference** | Attach context | ❌ None | No file attachment | Add `@file` parser to attach file content | Low | Test file attachment |
| **Session export** | Share conversations | ❌ None | No export | Add export to markdown | Low | Test export format |

### 3.3 P2 Features (Nice to Have)

| OpenCode Feature | Why It Matters | Current Status | Gap | Implementation Plan | Risk | Test Needed |
|------------------|----------------|----------------|-----|---------------------|------|-------------|
| **Web UI** | Browser interface | ❌ None | Major effort | Requires web frontend | High | N/A |
| **IDE extension** | Editor integration | ❌ None | Major effort | Requires VS Code extension | High | N/A |
| **ACP protocol** | Editor clients | ❌ None | Major effort | Requires JSON-RPC server | High | N/A |
| **SDK** | Programmatic access | ❌ None | Major effort | Requires TypeScript library | High | N/A |
| **LSP integration** | Code intelligence | ❌ None | Major effort | Requires LSP client | High | N/A |
| **Advanced plugins** | Rich extensions | ❌ None | Major effort | Requires plugin API | High | N/A |
| **Share links** | Public sessions | ❌ None | Security concerns | Requires hosting | High | N/A |
| **Managed config** | Enterprise settings | ❌ None | Niche use case | Requires MDM integration | Medium | N/A |

---

## Part 4: Implementation Plan

### Phase 1: Audit & Foundation (P0)
**Goal**: Complete OpenCode audit and implement core P0 features

**Tasks**:
1. ✅ Create `docs/opencode-benchmark.md` (this document)
2. 📋 Enhance TUI header with full status (mode, permission, git branch)
3. 📋 Implement Plan/Build modes system
4. 📋 Add command palette `/` with filterable list
5. 📋 Add provider/model picker (Ctrl+P)
6. 📋 Add permission panel
7. 📋 Implement `!command` shell execution
8. 📋 Add loading indicators
9. 📋 Add git branch display
10. 📋 Update README with workflow documentation

**Success Criteria**:
- TUI header shows: app, cwd, git branch, provider, model, mode, permission
- User can switch Plan/Build with Tab
- User can open command palette with `/`
- User can run `!git status` from TUI
- All existing tests pass
- New tests for Plan/Build, command palette, `!command`

### Phase 2: Advanced Features (P1)
**Goal**: Add custom commands, sessions, agents, diagnostics

**Tasks**:
1. 📋 Custom commands (markdown-based)
2. 📋 Sessions management (create/list/resume/export)
3. 📋 Agent registry and picker
4. 📋 Tool/event panel
5. 📋 Diagnostics panel
6. 📋 Undo/redo with git snapshots
7. 📋 `@file` reference support
8. 📋 MCP tools list
9. 📋 Plugin hooks (minimal)

**Success Criteria**:
- User can create custom command in `.selfimprove/commands/test.md`
- User can resume previous session
- User can switch to custom agent
- User sees tool calls in side panel
- User can undo last change

### Phase 3: Polish & Extend (P2)
**Goal**: Add advanced features and integrations

**Tasks**:
1. 📋 Web UI (if feasible)
2. 📋 IDE extension (if feasible)
3. 📋 LSP integration (optional)
4. 📋 Advanced plugin system
5. 📋 Share links (with security)
6. 📋 ACP protocol support

**Success Criteria**:
- User can access self-improve-cli from browser
- User can use self-improve-cli in VS Code
- User can get LSP diagnostics
- User can write custom plugins

---

## Part 5: Key Insights

### Why OpenCode Wins

1. **Mental Model Clarity**: Plan/Build modes make it obvious what the agent can do
2. **Status Awareness**: Header always shows context (cwd, git, provider, model, mode)
3. **Progressive Disclosure**: Start simple, discover features via `/`
4. **Reversibility**: Git snapshots + undo/redo reduce anxiety
5. **Composability**: Custom commands + MCP + plugins = infinite extensibility
6. **Workflow-Focused**: Docs teach "how to use" not just "what exists"

### What self-improve-cli Does Well

1. ✅ Don't-ask gate (autonomous mode with safety)
2. ✅ Self-improve pipeline (unique feature)
3. ✅ Swarm orchestrator (multi-agent)
4. ✅ Cross-platform (no native deps)
5. ✅ Lightweight (single blessed dep)
6. ✅ Plain JavaScript (no transpilers)

### What self-improve-cli Must Improve

1. ❌ No Plan/Build modes (critical for safe exploration)
2. ❌ No command palette (feature discovery)
3. ❌ TUI header incomplete (missing mode, permission, git)
4. ❌ No `!command` execution
5. ❌ No sessions (can't resume conversations)
6. ❌ No custom commands (can't define workflows)
7. ❌ No agent system (can't define custom agents)
8. ❌ Docs don't teach workflows

---

## Part 6: Next Steps

### Immediate (This Session)

1. **Enhance TUI header** to show full status
2. **Implement Plan/Build modes** with permission enforcement
3. **Add command palette** with filterable command list
4. **Add `!command` execution** from TUI
5. **Add loading indicators** for agent work
6. **Update README** with workflow examples

### Short-term (Next Session)

1. **Custom commands** (markdown-based)
2. **Sessions management** (list/resume/export)
3. **Agent registry** (custom agents)
4. **Diagnostics panel** (test/lint output)

### Long-term (Future Sessions)

1. **Undo/redo** with git snapshots
2. **Plugin system** with event hooks
3. **Web UI** (if feasible)
4. **IDE extension** (if feasible)

---

## References

- OpenCode Docs: https://opencode.ai/docs
- OpenCode GitHub: https://github.com/opencode-ai/opencode
- OpenCode Providers: https://opencode.ai/docs/providers/
- OpenCode Config: https://opencode.ai/docs/config/
- OpenCode Commands: https://opencode.ai/docs/commands/

---

**Document Version**: 1.0  
**Created**: 2026-06-21  
**Author**: Autoresearch agent  
**Status**: In progress — Phase 1 audit complete, ready for implementation

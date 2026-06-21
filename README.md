# self-improve-cli

A lightweight, cross-platform agentic coding CLI with self-improving harness, multi-agent swarm orchestration, autonomous mode, TUI interface, and a don't-ask gate. Zero external AI dependencies for core behavior — LLM optional.

## Quick Install

```bash
# Option 1: Install globally from npm (recommended)
npm install -g self-improve-cli

# Option 2: Clone and install
git clone https://github.com/mcpe500/self-improve-cli.git
cd self-improve-cli
npm install
npm link  # Makes 'sicli' available globally

# Option 3: One-liner install script
curl -fsSL https://raw.githubusercontent.com/mcpe500/self-improve-cli/main/install.sh | bash
```

Then initialize your workspace:
```bash
sicli init
sicli tui  # Launch TUI mode
```

## Design Goals

- Plain JavaScript. No transpilers, no Electron, no LSP, no watchers.
- Works on Linux, macOS, Windows.
- Manual by default; auto-apply only when growth policy allows.
- Low memory. `.selfimprove/` state dir, no external DB.
- All LLM features optional — CLI works without any API key.

## Architecture Overview

```
sicli
├── Chat (interactive / one-shot)
│   ├── Agent loop (runAgentTask)
│   ├── Autonomous mode (--dont-ask / harness config)
│   │   ├── Don't Ask Gate (ask_user tool)
│   │   │   ├── deterministicPolicy (never_ask patterns + risk_types)
│   │   │   ├── reviewQuestion (mmx-cli / chatCompletion fallback)
│   │   │   └── DeferredQuestionsQueue (max 5 budget)
│   │   ├── task_complete (self-declare done)
│   │   └── delegate_swarm (auto-delegate complex tasks)
│   └── Slash commands (/connect, /swarm, /self-improve, ...)
├── CLI commands
│   ├── config (show / get / set)
│   ├── permissions (secure / partial_secure / ai_reviewed / auto_approve)
│   ├── profile (compile, prompt, patch)
│   ├── growth (none / low / medium / high / very_high)
│   ├── self-improve (status / demo / learn / background-run / propose / promote / sandbox-eval)
│   ├── swarm (decompose → execute → critic → merge)
│   ├── daemon (start / stop / status / logs)
│   ├── tool (read / search / run / write / edit)
│   └── observe / improve / apply-patch
└── Background daemon
    ├── Event-driven (new traces trigger evaluation)
    ├── Interval-driven (every N minutes)
    └── HTTP API (localhost:3847 — /status, /candidates, /trigger, /stop)
```

## File Map

## New Files (TUI & Config System)

| File | Purpose |
|------|---------|
| `src/tui.js` | Terminal UI using blessed library |
| `src/config-paths.js` | Cross-platform config path resolution |
| `src/provider-registry.js` | Built-in and custom provider definitions |
| `src/superpowers.js` | Feature gate system with presets |
| `README_TUI.md` | Complete TUI documentation |

## Core Files

| File | Purpose |
|------|---------|
| `bin/self-improve-cli.js` | CLI entrypoint. Dispatches all commands. |
| `src/agent.js` | Agent loop, tool schemas, chat mode, slash commands, `runAgentTask` |
| `src/orchestrator.js` | Swarm orchestrator: `planFeatures`, `runFeatureAgent`, `runCritic`, `mergeResults` |
| `src/ask_gate.js` | Don't Ask Gate: `validateAskUserArgs`, `deterministicPolicy`, `DeferredQuestionsQueue`, `reviewQuestion` |
| `src/mmx-tools.js` | mmx-cli tool wrappers: `MMX_TOOL_SCHEMAS`, `MMX_TOOL_HANDLERS` |
| `src/provider.js` | OpenAI-compatible chat completion with 30s timeout |
| `src/config.js` | Config load/save, provider presets, permission modes |
| `src/profile.js` | Profile validation, JSON patch, growth gates, prompt compilation |
| `src/state.js` | `.selfimprove/` state, event/trace/patch logs, candidates, daemon state |
| `src/self-improve.js` | Self-improvement engine: diagnose, propose, critic, sandbox eval, pareto, background review |
| `src/daemon.js` | Background daemon loop with HTTP API |
| `src/tools.js` | Tool implementations: read, write, edit, search, run-command (shell=false) |
| `src/secrets.js` | API key secure storage with file permissions |
| `profiles/default.profile.json` | Immutable default harness profile |
| `test/*.test.js` | 57 built-in Node tests (55 pass, 2 pre-existing failures) |

## Quick Start

### 1. Launch TUI

```bash
# Start interactive terminal UI
sicli
# or explicitly
sicli tui
```

The TUI opens with:
- **Header**: Shows workspace, git branch, provider, model, mode (PLAN/BUILD), permission level
- **Chat panel**: Conversation history with agent
- **Input box**: Type prompts, slash commands, or shell commands
- **Status bar**: Keyboard shortcuts reminder

### 2. Choose Your Mode

self-improve-cli has two primary modes inspired by OpenCode:

**PLAN Mode** (read-only, safe for exploration):
- Analyze codebase
- Propose changes without editing
- Explore and understand
- Switch: Press `Tab` or type `/plan`

**BUILD Mode** (implementation):
- Edit and write files
- Run commands
- Apply changes
- Switch: Press `Tab` or type `/build`

The mode is shown in the header with color coding:
- `PLAN` in cyan = read-only
- `BUILD` in green = can edit

### 3. Discover Features

Press `Ctrl+K` for the **command palette** — filterable list of all commands with descriptions.

Press `Ctrl+P` for the **provider picker** — quick switch between OpenAI, Ollama, local models, etc.

Press `F1` for full help with all keyboard shortcuts.

### 4. Examples

**Explore in Plan mode:**
```
Tab  # Switch to PLAN if not already
Analyze this codebase and suggest improvements
```

**Run shell commands:**
```
!git status
!npm test
!ls -la src/
```

**Switch provider:**
```
Ctrl+P  # Opens provider picker
# or
/provider
```

**Use slash commands:**
```
/mode plan       # Switch to Plan mode
/mode build      # Switch to Build mode  
/config          # Open config menu
/mcp             # Manage MCP servers
/skills          # Enable/disable skills
/help            # Show help
```

**Regular chat:**
```
Fix the bug in src/auth.js where tokens expire too early
```

### 5. CLI Mode (No API Key Needed)

```bash
# No API key needed for basic operations
npm test
node bin/self-improve-cli.js init
node bin/self-improve-cli.js status
node bin/self-improve-cli.js config show
node bin/self-improve-cli.js profile --prompt

# Optional install
npm link
sicli status

# Launch TUI mode
sicli tui
# or
sicli --tui
```

## TUI Mode (NEW — OpenCode-Inspired DX)

sicli features a full-featured Terminal User Interface with:

### Core Features
- **Plan/Build Modes**: Safe exploration (Plan) vs implementation (Build)
- **Command Palette**: Press `Ctrl+K` to discover all commands
- **Provider Picker**: Press `Ctrl+P` for quick provider switching
- **Shell Integration**: Type `!git status` to run shell commands
- **Smart Header**: Always shows workspace, git branch, provider, model, mode, permission
- **Keyboard-First**: Tab to switch modes, arrow keys for history, tab for command completion

### Keyboard Shortcuts
- **Tab**: Switch Plan/Build modes
- **Ctrl+K**: Command palette (filterable)
- **Ctrl+P**: Provider picker
- **F1**: Help
- **F2**: Provider menu (detailed)
- **F3**: Config menu (local/global)
- **F4**: MCP servers
- **F5**: Skills
- **F6**: Superpowers (feature toggles)
- **F7**: Swarm orchestration
- **F8**: Theme selector
- **F9**: Export/import config
- **↑/↓**: Command history (100 buffer)

See [README_TUI.md](./README_TUI.md) for full TUI documentation and [docs/opencode-benchmark.md](./docs/opencode-benchmark.md) for design rationale.

## Provider System

### Built-in Providers

- **OpenAI**: `https://api.openai.com/v1`
- **MiniMax**: `https://api.minimax.chat/v1`
- **Z.AI**: `https://api.z.ai/v1`
- **Ollama (local)**: `http://localhost:11434/v1`
- **LM Studio (local)**: `http://localhost:1234/v1`
- **vLLM (local)**: `http://localhost:8000/v1`
- **OpenRouter**: `https://openrouter.ai/api/v1`

### Provider Management

```bash
# List providers
sicli provider list

# Switch provider
sicli provider use ollama

# Add custom OpenAI-compatible provider
sicli provider add my-provider \
  --base-url https://api.example.com/v1 \
  --model gpt-4 \
  --api-key-env MY_API_KEY

# Test connection
sicli provider test

# List/switch models
sicli provider models
```

### Config: Local vs Global

**Priority**: CLI flags > Local > Global > Env > Defaults

```bash
# View merged config
sicli config show

# View specific scope
sicli config show --local
sicli config show --global

# Set config
sicli config set temperature 0.7 --local
sicli config set active_model gpt-4o --global

# Get config paths
sicli config path --local   # .selfimprove/config.json
sicli config path --global  # ~/.config/self-improve-cli/config.json (Linux)
                            # ~/Library/Application Support/... (macOS)
                            # %APPDATA%/... (Windows)
```

## Superpowers (Feature Gates)

Toggle features on/off:

```bash
# List current state
sicli superpowers list

# Enable/disable individual
sicli superpowers enable autonomous
sicli superpowers disable swarm

# Apply preset
sicli superpowers preset safe      # Read-only, no autonomous
sicli superpowers preset balanced  # Moderate features
sicli superpowers preset power     # All features
```

**Available Superpowers**:
- `chat`: Interactive chat
- `tools`: File/shell operations
- `self_improve`: Self-improvement pipeline
- `swarm`: Multi-agent orchestration
- `skills`: Plugin system
- `mcp`: Model Context Protocol
- `autonomous`: Autonomous mode (don't-ask gate)
- `planning`: Task planning/decomposition
- `history`: History tracking
- `vision`: Image input (model-dependent)

## Chat Mode

### Setup
```bash
node bin/self-improve-cli.js chat
# or after npm link:
sicli

# Inside chat:
sicli> /connect minimax
sicli> /models
sicli> /key
```

### One-shot
```bash
node bin/self-improve-cli.js chat "read README and summarize" --yes
node bin/self-improve-cli.js chat "refactor auth controller" --dont-ask
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/connect [provider]` | Select provider (openai / minimax / zai) |
| `/key` | Store API key with hidden input |
| `/models [model]` | List or switch model |
| `/permissions [mode]` | View or change permission mode |
| `/self-improve [action]` | Self-improve status / enable / growth / demo / learn |
| `/swarm <prompt> [--yes]` | Decompose prompt → parallel feature agents → critic review |
| `/config` | Show full config |
| `/help` | List commands |
| `/exit` | Quit |

### Permission Modes

| Mode | Behavior |
|------|----------|
| `secure` | Ask before every tool call |
| `partial_secure` | Allow read/search and git-reversible writes/edits; ask otherwise |
| `ai_reviewed` | Model reviews action tools; asks if rejected |
| `auto_approve` | Autopilot: allow all profile-permitted tools |

## Autonomous Mode & Don't Ask Gate

When activated (via `--dont-ask` flag or `harness.autonomous_mode: true`), the agent:

1. **Continues by default** — no "should I continue?" interruptions
2. **Gate reviews questions** — `ask_user` tool calls go through `deterministicPolicy`:
   - `never_ask` patterns → **reject** (agent uses safe_default)
   - `file_delete`/`command_exec`/`api_key` + blocking → **reject**
   - `permission` + blocking → **review** (mmx-cli / chatCompletion)
   - Non-blocking → **defer** (collected at end, max 5)
3. **Deferred questions** displayed as report at task completion
4. **Budget enforcement** — max 5 deferred; beyond that auto-rejected
5. **task_complete tool** — agent self-declares done

```bash
# Activate autonomous
sicli chat "implement checkout flow high quality" --dont-ask
```

### Deferred Questions Output
```
--- Deferred Questions ---
1. Should I add coupon support?
   Reason: optional enhancement
   Risk: clarification | Blocking: false
   Safe default: skip for now
--- End Deferred Questions ---
```

## Swarm Orchestrator (Multi-Layer Subagents)

Decompose complex prompts into parallel features, each with its own agent + critic.

### CLI
```bash
# Preview decomposition
sicli swarm --plan-only "implement auth, logging, and rate limiting"

# Execute with parallel feature agents
sicli swarm --concurrency 3 "refactor all controllers"

# Allow critic retry loops
sicli swarm --max-critic-iterations 2 "implement payment flow"

# Interactive confirmation in chat
sicli> /swarm implement auth, logging, and caching
```

### Architecture
```
User Prompt
  ↓
Layer 1: Orchestrator (chatCompletion → planFeatures)
  → [feature1, feature2, feature3]
  ↓
Layer 2: Promise.allSettled (batch, concurrency=3)
  ├─ Feature Agent 1
  │   ├─ Worker (runAgentTask + tools)
  │   ├─ Critic (chatCompletion review)
  │   └─ Retry loop (optional)
  ├─ Feature Agent 2
  └─ Feature Agent 3
  ↓
Layer 1: mergeResults → { summary, successful[], warnings[], failed[] }
```

### Agentic trigger
In autonomous mode, the agent can self-delegate complex tasks using `delegate_swarm` tool.

## Self-Improve Pipeline

Background profile/harness evolution, not model fine-tuning.

```
each chat task
→ append trace to .selfimprove/traces.jsonl
→ scheduleBackgroundReview
→ runBackgroundReview scans new traces
→ failures become events.jsonl
→ diagnoseFailures (mmx-cli → chatCompletion → static)
→ buildHarnessPatch (mmx-cli → chatCompletion → static)
→ sandboxEvaluateCandidate (WorkerPool sim)
→ criticEvaluate (mmx-cli → chatCompletion → fallback)
→ computeParetoFrontier (dominance filter)
→ promoteCandidate (optional auto)
```

```bash
# Manual
node bin/self-improve-cli.js self-improve status
node bin/self-improve-cli.js self-improve demo
node bin/self-improve-cli.js self-improve background-run
node bin/self-improve-cli.js self-improve propose
node bin/self-improve-cli.js self-improve candidates

# Config
node bin/self-improve-cli.js config set self_improve_background true
node bin/self-improve-cli.js config set self_improve_review_every 1
node bin/self-improve-cli.js growth medium --auto-apply true
```

## Growth Policy

| Level | Auto-Apply | Patch Surface |
|-------|------------|---------------|
| none | — | Blocked |
| low | manual | Rules, lessons |
| medium | configurable | Rules, memory |
| high | configurable | Rules, memory, style, tool_policy |
| very_high | configurable | Rules, memory, style, tool_policy, growth (protected from self-escalation) |

## Daemon Mode

Background process for continuous self-improvement:

```bash
sicli self-improve daemon start [--interval=15] [--port=3847]
sicli self-improve daemon status
sicli self-improve daemon stop
sicli self-improve daemon logs --tail=50
```

HTTP API at `http://localhost:3847`:
- `GET /status` — daemon + evaluation state
- `GET /candidates` — scored patch candidates
- `POST /trigger` — force evaluation on next loop
- `POST /stop` — graceful shutdown

## mmx-cli Integration

Optional MiniMax AI tools available to feature agents when profile allows:

```json
// .selfimprove/overlay.profile.json
{ "tool_policy": { "mmx_search": "allow", "mmx_text_chat": "allow" } }
```

Requires `mmx-cli` installed globally:
```bash
npm install -g mmx-cli
mmx auth login --api-key sk-xxxxx
```

## Coding Tools

```bash
node bin/self-improve-cli.js tool read README.md
node bin/self-improve-cli.js tool search pattern [dir]
node bin/self-improve-cli.js tool run npm test
node bin/self-improve-cli.js tool write hello.md "# Hello"
node bin/self-improve-cli.js tool edit README.md old_text new_text
```

`tool run` uses `child_process.spawn` with `shell: false`.

## State Directory (`.selfimprove/`)

| File | Description |
|------|-------------|
| `base.profile.json` | Immutable base profile (do not edit) |
| `overlay.profile.json` | Mutable overlay profile (bak.0/1/2 backups) |
| `config.json` | Provider/model/permission config |
| `secrets.json` | Encrypted API keys |
| `events.jsonl` | Observed events |
| `traces.jsonl` | Task execution traces |
| `patches.jsonl` | Profile patch audit log |
| `optimizer.json` | Self-improve optimizer state |
| `daemon.json` | Daemon runtime state |
| `daemon.pid` | Daemon process ID |
| `swarm/<run-id>/` | Swarm execution artifacts |
| `candidates/<id>/` | Patch candidates (harness + scores) |

All gitignored.

## Provider Presets

| Provider | Base URL | API Key Env | Models |
|----------|----------|-------------|--------|
| OpenAI | `https://api.openai.com/v1` | `OPENAI_API_KEY` | `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1` |
| MiniMax Coding Plan | `https://api.minimax.io/v1` | `MINIMAX_API_KEY` | `MiniMax-M2.7`, `MiniMax-M2.7-highspeed` |
| Z.AI Coding Plan | `https://api.z.ai/api/coding/paas/v4` | `ZAI_API_KEY` | `GLM-5.1`, `GLM-5`, `GLM-5-Turbo`, `GLM-4.7`, `GLM-4.5-air` |

## Test Suite

```bash
npm test
```

55/57 pass. 2 pre-existing failures in `test/self-improve.test.js` (trace assertion mismatch, unrelated).

## Windows Compatibility

All platform-specific shell scripts avoided. Uses Node.js built-ins (`fs`, `path`, `child_process.spawn` with `shell=false`). Tested on Windows, Linux, macOS.

## Spec-Driven LLM Wiki

See `spec-driven-llm-wiki/` for: numbered specs, wiki, graph, templates, tools, and handoffs — a portable spec-driven development memory system.

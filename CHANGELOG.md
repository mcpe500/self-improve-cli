# Changelog

All notable changes to sicli will be documented in this file.

## [0.2.0] - 2024-06-20

### Added - TUI & Config System Major Update

#### Terminal User Interface (TUI)
- **Full-featured TUI mode** with blessed library
  - Launch with `sicli tui` or `sicli --tui`
  - F1-F9 keyboard shortcuts for all features
  - Interactive chat with scrollable history
  - Real-time status updates in header

#### Enhanced Features
- **Mouse Support**
  - Click to focus input/chat areas
  - Click buttons in forms and menus
  - Click list items to select
  - Mouse wheel scrolling (terminal dependent)

- **Command History (100 commands)**
  - ↑/↓ arrows to navigate
  - Persistent during session
  - Auto-resets on new input

- **Tab Completion**
  - Auto-complete slash commands
  - Shows all matches for partial input
  - Adds space after completion

- **Multi-line Input**
  - Textarea instead of single-line textbox
  - Supports longer prompts
  - Scrollable when content exceeds height

#### MCP Management (F4)
- **Add MCP Server** with interactive form
  - Server name, command, args, environment variables
  - Mouse-clickable buttons
  - Validation and error handling
- **Remove MCP Server** from list
- **View Server Details** with JSON viewer
- **Reload MCP** configuration

#### Theme System (F8)
- **5 Built-in Themes**:
  - `default`: Purple accents, blue header
  - `dark`: Minimal dark gray
  - `light`: High contrast light mode
  - `ocean`: Blue/cyan ocean theme
  - `matrix`: Green on black
- Real-time theme switching
- Theme persists in config
- Affects header, chat, input, status bar

#### Export/Import Config (F9)
- **Export Config** to timestamped JSON files
  - Local scope only
  - Global scope only
  - Merged config (full active)
- **Import Config** from JSON file
  - Import to local or global
  - Automatic backup (.bak) before import
  - JSON validation

#### Config System Overhaul
- **Layered Config Priority**:
  1. CLI flags (highest)
  2. Local workspace (`.selfimprove/config.json`)
  3. Global user config (platform-specific)
  4. Environment variables
  5. Defaults (lowest)

- **Cross-Platform Global Config**:
  - Windows: `%APPDATA%/self-improve-cli/config.json`
  - macOS: `~/Library/Application Support/self-improve-cli/config.json`
  - Linux: `${XDG_CONFIG_HOME:-~/.config}/self-improve-cli/config.json`

- **Auto-Migration**
  - Legacy config format automatically migrated
  - Backup created before migration
  - Backward compatible

#### Provider System
- **7 Built-in Providers**:
  - OpenAI, MiniMax, Z.AI
  - Ollama (local)
  - LM Studio (local)
  - vLLM (local)
  - OpenRouter

- **Provider Registry**
  - Central registry for built-in providers
  - Custom provider support
  - Provider add/remove/list/use/test commands

#### Superpowers System
- **10 Feature Gates**:
  - chat, tools, self_improve, swarm, skills, mcp
  - autonomous, planning, history, vision

- **3 Presets**:
  - `safe`: Read-only, no autonomous
  - `balanced`: Moderate features
  - `power`: All features enabled

- **CLI Commands**:
  ```bash
  sicli superpowers list
  sicli superpowers enable <name>
  sicli superpowers disable <name>
  sicli superpowers preset <safe|balanced|power>
  ```

#### New CLI Commands
```bash
# TUI
sicli tui
sicli --tui

# Provider
sicli provider list
sicli provider use <id>
sicli provider add <id> --base-url <url> [--model <model>]
sicli provider remove <id>
sicli provider models
sicli provider test

# Config
sicli config show [--local|--global]
sicli config set <key> <value> [--local|--global]
sicli config path [--local|--global]
sicli config validate

# Superpowers
sicli superpowers list
sicli superpowers enable <name>
sicli superpowers disable <name>
sicli superpowers preset <safe|balanced|power>
```

#### New Modules
- `src/tui.js` - Terminal UI (blessed-based)
- `src/config-paths.js` - Cross-platform config paths
- `src/provider-registry.js` - Provider definitions
- `src/superpowers.js` - Feature gate system

#### Tests
- Added 22 new tests (113 → 122 total)
- All tests passing
- Coverage for:
  - Provider registry
  - Superpowers
  - Config paths
  - TUI features
  - Tab completion
  - Theme system

#### Documentation
- `README_TUI.md` - Complete TUI documentation
- `README.md` - Updated with TUI, providers, superpowers
- Usage examples for all new features
- Keyboard shortcuts reference
- Theme showcase
- Export/import guide

### Changed
- Config format migrated to new registry-based system
- Provider selection now uses registry IDs
- Secrets storage updated to support both formats
- Status bar shows more shortcuts (F8, F9)

### Fixed
- Config backward compatibility maintained
- Tests updated for new config format
- Cross-platform path handling

## [0.1.0] - 2024-06-19

### Initial Release
- Basic CLI functionality
- Chat mode with slash commands
- Self-improvement pipeline
- Swarm orchestration
- Autonomous mode with don't-ask gate
- Permission modes
- Skills system
- MCP support
- Profile management
- 92 tests passing

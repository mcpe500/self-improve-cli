# TUI Mode - Terminal User Interface

## Overview

sicli now includes a Terminal User Interface (TUI) mode for interactive management of providers, config, superpowers, skills, MCP servers, and chat.

## Starting TUI

```bash
# Launch TUI
sicli tui

# Or as default with flag
sicli --tui
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F1` | Show help |
| `F2` | Provider menu (select/add providers) |
| `F3` | Config menu (view/edit config) |
| `F4` | MCP menu (manage MCP servers) |
| `F5` | Skills menu (enable/disable skills) |
| `F6` | Superpowers menu (toggle features) |
| `F7` | Swarm menu (multi-agent orchestration) |
| `F8` | Theme menu (change colors) |
| `F9` | Export/Import config |
| `Enter` | Send message |
| `↑` / `↓` | Navigate command history |
| `Tab` | Auto-complete commands |
| `Escape` | Return to chat / Cancel |
| `Ctrl+C` | Exit TUI |
| `Mouse Click` | Focus/interact with elements |

## Features

### Provider Management (F2)
- List all available providers (OpenAI, MiniMax, Z.AI, Ollama, etc.)
- Switch active provider with mouse or keyboard
- Add custom OpenAI-compatible providers
- View active provider and model in header
- Mouse support for clicking menu items

### Config Management (F3)
- View local config (`.selfimprove/config.json`)
- View global config (`~/.config/self-improve-cli/config.json`)
- Validate config
- See merged config with local overriding global

### MCP Servers (F4) - NEW!
- List configured MCP servers with details
- **Add MCP server** with interactive form:
  - Server name
  - Command (e.g., `npx`)
  - Arguments (comma-separated)
  - Environment variables (KEY=VAL)
- **Remove MCP server** from list
- Reload MCP configuration
- View server details with JSON viewer
- Mouse-clickable buttons

### Skills (F5)
- View all discovered skills
- Enable/disable skills with click or Enter
- See active skills marked with `[ENABLED]`
- Mouse support for toggling

### Superpowers (F6)
- Toggle individual features (chat, tools, self_improve, swarm, skills, mcp, autonomous, planning, history, vision)
- Apply presets:
  - **Safe**: Read-only, no autonomous
  - **Balanced**: Moderate features, manual approval
  - **Power**: All features enabled
- Mouse support for toggling and preset buttons

### Themes (F8) - NEW!
- **5 built-in themes**:
  - **default**: Purple accents, blue header
  - **dark**: Minimal dark gray
  - **light**: High contrast light mode
  - **ocean**: Blue/cyan ocean theme
  - **matrix**: Green on black (Matrix style)
- Theme persists in config
- Real-time color changes
- Mouse-clickable theme selector

### Export/Import (F9) - NEW!
- **Export config** to JSON file:
  - Local scope only
  - Global scope only
  - Merged config (full active config)
  - Auto-timestamped filenames
- **Import config** from JSON file:
  - Import to local workspace
  - Import to global user config
  - Automatic backup before import
  - Validates JSON before applying
- Mouse support for all buttons

### Chat
- Main panel shows conversation history with scrolling
- **Multi-line input support** (textarea instead of textbox)
- **Command history**: ↑/↓ arrows to navigate previous commands (100 command buffer)
- **Tab completion**: Auto-complete slash commands
  - Type `/hel` + Tab → `/help `
  - Shows all matches if multiple
- Supports slash commands (`/help`, `/provider`, `/config`, etc.)
- Color-coded messages (user, agent, info, error, success)
- Mouse-clickable input box

## Slash Commands in TUI

```
/help              Show help
/provider          Open provider menu
/config            Open config menu
/mcp               Open MCP menu
/skills            Open skills menu
/powers            Open superpowers menu
/superpowers       Alias for /powers
/swarm <prompt>    Run swarm orchestration
/theme             Open theme menu
/export            Open export/import menu
/import            Open export/import menu
/exit              Exit TUI
```

**Tab Completion**: Type the first few characters and press Tab to auto-complete.

**Command History**: Use ↑/↓ arrows to cycle through previous commands.

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ sicli | workspace | provider / model | permission_mode │  Header (themed)
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Chat History (scrollable, mouse-clickable)             │  Main Panel
│  [timestamp] INFO: message                              │
│  [timestamp] You: prompt                                │
│  [timestamp] Agent: response                            │
│  [timestamp] SUCCESS: operation completed               │
│                                 ↕ scrollbar             │
├─────────────────────────────────────────────────────────┤
│ F1-F9:Menus | ↑↓:History Tab:Complete | Ctrl+C:Exit    │  Status Bar
├─────────────────────────────────────────────────────────┤
│ > your input here (multi-line, mouse-clickable)        │  Input Box
│   supports newlines, history, tab completion            │
└─────────────────────────────────────────────────────────┘
```

**Color Themes**: Header, chat, input, and status bar colors change with theme.

## Provider Examples

### Add Custom Provider

1. Press `F2` to open provider menu
2. Select "+ Add custom provider"
3. Fill in:
   - **ID**: `my-provider` (unique identifier)
   - **Label**: `My Custom Provider`
   - **Base URL**: `https://api.example.com/v1`
   - **API Key Env Var**: `MY_PROVIDER_KEY`
   - **Models**: `model-a,model-b` (comma-separated)
4. Press "Save"

### Switch to Ollama (Local)

1. Press `F2` (or type `/provider` + Enter)
2. Select "Ollama (Local)" with arrow keys or mouse click
3. Provider switches to `http://localhost:11434/v1`
4. No API key required for local

### Add MCP Server

1. Press `F4` to open MCP menu
2. Select "+ Add MCP server"
3. Fill in form:
   - **Server Name**: `filesystem`
   - **Command**: `npx`
   - **Args**: `@modelcontextprotocol/server-filesystem,/home/user/projects`
   - **Env**: `DEBUG=true` (optional)
4. Click "Add Server" or press Enter
5. Server appears in MCP list immediately

### Remove MCP Server

1. Press `F4` to open MCP menu
2. Select "- Remove MCP server"
3. Choose server from list
4. Server removed immediately (no confirmation)

### Change Theme

1. Press `F8` to open theme menu
2. Select theme (default, dark, light, ocean, matrix)
3. Colors update immediately
4. Theme saved to local config

### Export Config

1. Press `F9` to open export/import menu
2. Select "Export config (local/global/merged)"
3. File created: `sicli-config-<scope>-<timestamp>.json`
4. Success message shows filename

### Import Config

1. Press `F9` to open export/import menu
2. Select "Import config to local/global"
3. Enter file path (relative or absolute)
4. Original config backed up to `.bak` file
5. New config applied and validated

## Superpowers Presets

### Safe Preset
```json
{
  "chat": true,
  "tools": false,
  "self_improve": false,
  "swarm": false,
  "skills": false,
  "mcp": false,
  "autonomous": false,
  "planning": true,
  "history": true,
  "vision": false
}
```

### Balanced Preset
```json
{
  "chat": true,
  "tools": true,
  "self_improve": true,
  "swarm": true,
  "skills": true,
  "mcp": true,
  "autonomous": false,
  "planning": true,
  "history": true,
  "vision": false
}
```

### Power Preset
```json
{
  "chat": true,
  "tools": true,
  "self_improve": true,
  "swarm": true,
  "skills": true,
  "mcp": true,
  "autonomous": true,
  "planning": true,
  "history": true,
  "vision": true
}
```

## Config Priority

1. **CLI flags** / runtime overrides (highest priority)
2. **Local workspace config**: `<workspace>/.selfimprove/config.json`
3. **Global user config**:
   - Windows: `%APPDATA%/self-improve-cli/config.json`
   - macOS: `~/Library/Application Support/self-improve-cli/config.json`
   - Linux: `${XDG_CONFIG_HOME:-~/.config}/self-improve-cli/config.json`
4. **Environment variables**
5. **Default config** (lowest priority)

## Cross-Platform Support

- Works on Linux, macOS, Windows
- Uses platform-specific config paths
- Graceful fallback for unsupported terminal features
- ANSI colors and readline support

## Advanced Features

### Multi-line Input

The input box supports multi-line text entry:
- Press Enter to submit
- Use Shift+Enter for newlines (terminal dependent)
- Scroll within input if content exceeds box height

### Command History

Last 100 commands are stored in memory:
- Press ↑ to go back in history
- Press ↓ to go forward
- History index resets on new command
- Empty input if you go past the end

### Tab Completion

Auto-completes slash commands:
- `/hel` + Tab → `/help `
- `/pr` + Tab → `/provider `
- Shows "Completions: ..." if multiple matches
- Works with all slash commands

### Mouse Support

- Click input box to focus
- Click chat area to focus and scroll
- Click buttons in forms and menus
- Click list items to select
- Scroll chat history with mouse wheel (terminal dependent)

### Theme System

Customize TUI appearance:
- 5 built-in themes (default, dark, light, ocean, matrix)
- Themes affect header, chat, input, status bar colors
- Theme choice persists in config
- Apply theme instantly with F8

### Export/Import

Backup and restore config:
- Export generates timestamped JSON files
- Import validates JSON before applying
- Automatic .bak backup before import
- Supports local, global, or merged scope

## Known Limitations

- Multi-line input uses textarea (some terminals may not support Shift+Enter)
- Mouse support depends on terminal capabilities (works best in modern terminals)
- Ctrl+C exits immediately (no confirmation dialog)
- Very long chat history may slow rendering (auto-limits to recent messages)

## CLI Equivalents

All TUI features have CLI equivalents:

```bash
# Provider
sicli provider list
sicli provider use ollama
sicli provider add custom --base-url https://api.example.com/v1

# Config
sicli config show
sicli config show --local
sicli config show --global
sicli config set key value

# Superpowers
sicli superpowers list
sicli superpowers enable autonomous
sicli superpowers preset power

# Skills
sicli skills list
sicli skills enable autoresearch-create

# MCP
sicli mcp list
sicli mcp add server-name --command npx --args @modelcontextprotocol/server-filesystem
```

## Troubleshooting

### TUI doesn't render correctly
- Check terminal supports ANSI colors
- Try resizing terminal window
- Use CLI commands as fallback

### Provider connection fails
- Check API key is set: `sicli config show`
- Test connection: `sicli provider test`
- Verify base URL is correct

### Config changes not taking effect
- Check which scope: `sicli config path --local` vs `sicli config path --global`
- Local config overrides global
- Restart TUI after manual config edits

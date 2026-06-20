# Quick Start Guide

## 5-Minute Setup

### 1. Install

```bash
npm install -g self-improve-cli
```

### 2. Initialize

```bash
mkdir my-project
cd my-project
sicli init
```

### 3. Configure Provider

```bash
# Launch TUI
sicli tui

# Inside TUI:
# 1. Press F2 (Provider menu)
# 2. Select your provider (OpenAI, Ollama, etc.)
# 3. For cloud providers, use /key to enter API key
```

### 4. Start Coding!

```bash
# Option A: Use TUI (Recommended)
sicli tui
# Then type your requests in the chat

# Option B: One-shot commands
sicli chat "add README with project description" --yes

# Option C: Interactive CLI
sicli
# Then use slash commands
```

## Essential Commands

```bash
# TUI Mode (Full-featured)
sicli tui                    # Launch TUI
# F1: Help, F2: Provider, F6: Superpowers, F8: Theme

# Quick Tasks
sicli chat "your task" --yes           # One-shot task
sicli swarm "complex task" --yes       # Multi-agent mode

# Configuration
sicli provider list                    # Show all providers
sicli provider use ollama              # Switch to Ollama
sicli config show                      # View config
sicli superpowers preset power         # Enable all features

# Status
sicli status                           # Show workspace status
sicli provider test                    # Test provider connection
```

## Common Workflows

### Use Local AI (No API Key)

```bash
# 1. Install Ollama: https://ollama.ai
# 2. Pull a model: ollama pull qwen2.5-coder
# 3. Configure sicli:
sicli provider use ollama
sicli config set active_model qwen2.5-coder
sicli tui
```

### Use OpenAI

```bash
sicli provider use openai
sicli tui
# Press F2, select OpenAI, then use /key to enter API key
# Or: export OPENAI_API_KEY="sk-..."
```

### Multi-Agent Swarm

```bash
# Decompose complex tasks into parallel features
sicli swarm "implement auth, logging, and caching" --yes

# Or in TUI: Press F7
```

### Add Skills

```bash
# List available skills
sicli skills list

# Enable a skill
sicli skills enable autoresearch-create

# Or in TUI: Press F5, select skill
```

### Add MCP Servers

```bash
# In TUI: Press F4
# Select "+ Add MCP server"
# Example: filesystem server
#   Name: filesystem
#   Command: npx
#   Args: @modelcontextprotocol/server-filesystem,/path/to/dir

# Or CLI:
sicli mcp add filesystem --command npx \
  --args "@modelcontextprotocol/server-filesystem,/path"
```

## TUI Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F1` | Help menu |
| `F2` | Provider selection |
| `F3` | Config management |
| `F4` | MCP servers |
| `F5` | Skills management |
| `F6` | Superpowers (feature gates) |
| `F7` | Swarm orchestration |
| `F8` | Theme selection |
| `F9` | Export/Import config |
| `↑/↓` | Command history |
| `Tab` | Auto-complete commands |
| `Ctrl+C` | Exit |

## Troubleshooting

### "Command not found: sicli"

```bash
# Check npm bin location
npm bin -g

# Add to PATH
export PATH="$(npm bin -g):$PATH"
echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
```

### TUI not rendering correctly

```bash
# Check terminal
echo $TERM  # Should be xterm-256color or similar

# Try different terminal emulator
# Linux: GNOME Terminal, Konsole, Alacritty
# macOS: iTerm2, Terminal.app
# Windows: Windows Terminal

# Fallback: Use CLI mode
sicli chat "your task" --yes
```

### Provider connection fails

```bash
# Test connection
sicli provider test

# Check API key
sicli config show | grep api_key_env
echo $OPENAI_API_KEY  # Check env var

# For local (Ollama):
curl http://localhost:11434/api/tags  # Check Ollama running
```

## Next Steps

1. **Explore TUI**: `sicli tui` then press F1 for help
2. **Read docs**: `README.md`, `README_TUI.md`, `INSTALL.md`
3. **Try examples**:
   ```bash
   sicli chat "analyze this codebase and suggest improvements" --yes
   sicli swarm "refactor all controllers" --yes
   ```
4. **Configure**: Press F6 in TUI to enable/disable features
5. **Customize**: Press F8 in TUI to change theme

## Resources

- **GitHub**: https://github.com/mcpe500/self-improve-cli
- **Issues**: https://github.com/mcpe500/self-improve-cli/issues
- **Full Install Guide**: INSTALL.md
- **TUI Guide**: README_TUI.md

## Example Session

```bash
# Initialize project
mkdir my-app && cd my-app
sicli init

# Configure Ollama (no API key needed)
sicli provider use ollama

# Launch TUI
sicli tui

# Inside TUI, type:
Create a REST API with user authentication

# Agent will:
# 1. Read existing files
# 2. Create new files
# 3. Show progress
# 4. Verify with tests

# Press ↑ to see previous commands
# Press F5 to enable skills
# Press F8 to change theme
# Press Ctrl+C to exit
```

Happy coding! 🚀

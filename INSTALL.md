# Installation Guide

## Prerequisites

- Node.js >= 18
- npm or yarn
- Terminal with UTF-8 and ANSI color support (for TUI)

## Installation Methods

### Method 1: NPM Global Install (Recommended)

```bash
npm install -g self-improve-cli
```

After installation:
```bash
sicli --version
sicli init
sicli tui
```

### Method 2: Clone and Link

```bash
# Clone repository
git clone https://github.com/mcpe500/self-improve-cli.git
cd self-improve-cli

# Install dependencies
npm install

# Link globally
npm link

# Verify
sicli --version
```

### Method 3: One-liner Install Script

```bash
curl -fsSL https://raw.githubusercontent.com/mcpe500/self-improve-cli/main/install.sh | bash
```

### Method 4: Use without Installing

```bash
# Clone repository
git clone https://github.com/mcpe500/self-improve-cli.git
cd self-improve-cli
npm install

# Run directly
node bin/self-improve-cli.js --help
node bin/self-improve-cli.js tui
```

## First Run Setup

### 1. Initialize Workspace

```bash
# Initialize .selfimprove/ directory
sicli init
```

This creates:
- `.selfimprove/config.json` - Local config
- `.selfimprove/base.profile.json` - Immutable base profile
- `.selfimprove/overlay.profile.json` - Mutable overlay
- `.selfimprove/secrets.json` - API keys (not committed)

### 2. Configure Provider

```bash
# Option A: Use TUI
sicli tui
# Press F2 → Select provider → Enter API key

# Option B: Use CLI
sicli provider use openai
sicli config set active_model gpt-4.1-mini
# Then in chat mode: /key to enter API key

# Option C: Use environment variable
export OPENAI_API_KEY="sk-..."
```

### 3. Test Installation

```bash
# Run tests
npm test  # Should show 122 tests passing

# Test CLI
sicli status
sicli config show
sicli provider list

# Test TUI
sicli tui
```

## Platform-Specific Notes

### Linux

```bash
# Install Node.js 18+ (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install sicli
npm install -g self-improve-cli

# Config location
~/.config/self-improve-cli/config.json
```

### macOS

```bash
# Install Node.js with Homebrew
brew install node

# Install sicli
npm install -g self-improve-cli

# Config location
~/Library/Application Support/self-improve-cli/config.json
```

### Windows

```powershell
# Install Node.js from https://nodejs.org
# Or use winget
winget install OpenJS.NodeJS

# Install sicli
npm install -g self-improve-cli

# Config location
%APPDATA%\self-improve-cli\config.json
```

### Termux (Android)

```bash
# Install Node.js
pkg install nodejs

# Install sicli
npm install -g self-improve-cli

# Config location
$PREFIX/etc/self-improve-cli/config.json
```

## Troubleshooting

### Permission Errors

```bash
# Fix npm permissions (Linux/macOS)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then install again
npm install -g self-improve-cli
```

### Command Not Found

```bash
# Check npm bin location
npm bin -g

# Add to PATH
export PATH="$(npm bin -g):$PATH"

# Make permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
```

### TUI Not Rendering

```bash
# Check terminal supports ANSI colors
echo $TERM  # Should be xterm-256color or similar

# Try different terminal
# - Linux: GNOME Terminal, Konsole, Alacritty
# - macOS: iTerm2, Alacritty, Terminal.app
# - Windows: Windows Terminal, ConEmu, Cmder

# Fallback: Use CLI mode
sicli chat "your prompt" --yes
```

### Module Not Found

```bash
# Reinstall dependencies
cd $(npm root -g)/self-improve-cli
npm install

# Or reinstall globally
npm uninstall -g self-improve-cli
npm install -g self-improve-cli
```

## Uninstall

```bash
# Remove global package
npm uninstall -g self-improve-cli

# Remove config files
# Linux
rm -rf ~/.config/self-improve-cli

# macOS
rm -rf ~/Library/Application\ Support/self-improve-cli

# Windows
del /s /q %APPDATA%\self-improve-cli

# Remove workspace state (if desired)
rm -rf .selfimprove
```

## Updating

```bash
# Update to latest version
npm update -g self-improve-cli

# Or reinstall
npm uninstall -g self-improve-cli
npm install -g self-improve-cli

# Check version
sicli --version
```

## Verify Installation

Run this checklist:

```bash
# 1. Version check
sicli --version  # Should show 0.2.0 or higher

# 2. Help works
sicli --help  # Should show usage

# 3. Init works
mkdir test-sicli && cd test-sicli
sicli init  # Should create .selfimprove/

# 4. Config works
sicli config show  # Should show JSON config

# 5. Provider works
sicli provider list  # Should show 7 providers

# 6. TUI works
sicli tui  # Should open TUI (Ctrl+C to exit)

# 7. Tests pass (if cloned)
npm test  # Should show 122 tests passing
```

If all checks pass, installation is successful! ✅

## Next Steps

1. Read [README.md](README.md) for feature overview
2. Read [README_TUI.md](README_TUI.md) for TUI guide
3. Try: `sicli tui` and press F1 for help
4. Configure provider and API key
5. Start chatting: `sicli chat "Hello!" --yes`

## Getting Help

- GitHub Issues: https://github.com/mcpe500/self-improve-cli/issues
- Documentation: https://github.com/mcpe500/self-improve-cli
- In TUI: Press F1 for help
- In CLI: `sicli --help`

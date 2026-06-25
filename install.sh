#!/usr/bin/env bash
# Quick install script for sicli

set -e

echo "🚀 Installing sicli (Self-Improving CLI)..."
echo ""

# Fix stale installs that left broken symlinks/files behind.
# -e returns false on dangling symlinks, so use -L first.
GLOBAL_PREFIX=$(npm prefix -g 2>/dev/null || echo "")
if [ -n "$GLOBAL_PREFIX" ]; then
  STALE="$GLOBAL_PREFIX/lib/node_modules/self-improve-cli"
  if [ -L "$STALE" ] || { [ -e "$STALE" ] && [ ! -d "$STALE" ]; }; then
    echo "⚠️  Removing stale entry: $STALE"
    rm -rf "$STALE"
  fi
  # Also clean up stale bin symlink
  STALE_BIN="$GLOBAL_PREFIX/bin/sicli"
  if [ -L "$STALE_BIN" ] && [ ! -e "$STALE_BIN" ]; then
    echo "⚠️  Removing stale bin: $STALE_BIN"
    rm -f "$STALE_BIN"
  fi
fi

# Install globally from GitHub (works from any directory)
npm install -g github:mcpe500/self-improve-cli

echo ""
echo "✅ Installation complete!"
echo ""
echo "📖 Quick start:"
echo "  sicli init          # Initialize workspace"
echo "  sicli tui           # Launch TUI mode"
echo "  sicli --help        # Show all commands"
echo ""
echo "🔗 For local development:"
echo "  cd self-improve-cli && npm install && npm link"
echo ""

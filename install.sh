#!/usr/bin/env bash
# Quick install script for sicli

set -e

echo "🚀 Installing sicli (Self-Improving CLI)..."
echo ""

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
echo "  npm link            # Link globally"
echo "  npm test            # Run tests"
echo ""

#!/usr/bin/env bash
# Installer for sicli — Self-Improving CLI
# Works on Linux, macOS, Windows (Git Bash), and Termux Android.
# https://github.com/mcpe500/self-improve-cli
#
# Strategy: clone → npm install → npm link.
# This avoids npm's git-dep-preparation which is broken on Termux
# (spawns sh into a CWD that npm already removed → ENOENT).

set -euo pipefail

REPO_URL="https://github.com/mcpe500/self-improve-cli.git"
CLONE_DIR="${TMPDIR:-/tmp}/sicli-install-$$"

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m▸ %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
warn()  { printf '\033[1;33m⚠ %s\033[0m\n' "$1"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

cleanup() { rm -rf "$CLONE_DIR" 2>/dev/null || true; }
trap cleanup EXIT

# ── Pre-flight checks ───────────────────────────────────────────────

command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js >= 18 first."
command -v npm  >/dev/null 2>&1 || fail "npm not found. Install Node.js >= 18 first."
command -v git  >/dev/null 2>&1 || fail "git not found. Install git first."

NODE_VER=$(node -e "console.log(parseInt(process.versions.node,10))" 2>/dev/null || echo 0)
[ "$NODE_VER" -ge 18 ] || fail "Node.js >= 18 required, found v${NODE_VER}."

info "Node v$(node -v), npm v$(npm -v)"

# ── Detect global prefix & bin dir ──────────────────────────────────

GLOBAL_PREFIX=$(npm prefix -g 2>/dev/null || true)
[ -n "$GLOBAL_PREFIX" ] || fail "Cannot determine npm global prefix. Run: npm prefix -g"

GLOBAL_BIN="$GLOBAL_PREFIX/bin"

# Ensure global bin is on PATH
case ":${PATH}:" in
  *":${GLOBAL_BIN}:"*) ;;
  *)
    warn "$GLOBAL_BIN is not in your PATH."
    warn "Add to ~/.bashrc or ~/.zshrc:"
    warn "  export PATH=\"${GLOBAL_BIN}:\$PATH\""
    ;;
esac

info "npm global prefix: $GLOBAL_PREFIX"
info "npm global bin:    $GLOBAL_BIN"

# ── Clean up stale installs ─────────────────────────────────────────

MODULE_DIR="$GLOBAL_PREFIX/lib/node_modules/self-improve-cli"
BIN_LINK="$GLOBAL_BIN/sicli"

if [ -L "$MODULE_DIR" ] || { [ -e "$MODULE_DIR" ] && [ ! -d "$MODULE_DIR" ]; }; then
  warn "Removing stale entry: $MODULE_DIR"
  rm -rf "$MODULE_DIR"
fi

if [ -L "$BIN_LINK" ] && [ ! -e "$BIN_LINK" ]; then
  warn "Removing stale bin symlink: $BIN_LINK"
  rm -f "$BIN_LINK"
fi

# ── Clone → install → link ──────────────────────────────────────────

info "Cloning $REPO_URL ..."
git clone --depth 1 "$REPO_URL" "$CLONE_DIR" 2>&1 || fail "git clone failed."

info "Installing dependencies..."
(cd "$CLONE_DIR" && npm install --ignore-scripts 2>&1) || fail "npm install failed."

info "Linking globally..."
(cd "$CLONE_DIR" && npm link 2>&1) || {
  # npm link can fail on Termux too — try manual symlink as fallback
  warn "npm link failed. Creating manual symlink..."
  mkdir -p "$GLOBAL_BIN"
  ln -sf "$CLONE_DIR/bin/self-improve-cli.js" "$BIN_LINK"
  chmod +x "$BIN_LINK"
  ok "Manual symlink: $BIN_LINK"
}

# ── Verify ──────────────────────────────────────────────────────────

if command -v sicli >/dev/null 2>&1; then
  ok "sicli found at: $(command -v sicli)"
else
  # Final fallback: try creating symlink directly
  if [ -x "$CLONE_DIR/bin/self-improve-cli.js" ]; then
    mkdir -p "$GLOBAL_BIN"
    ln -sf "$CLONE_DIR/bin/self-improve-cli.js" "$BIN_LINK"
    chmod +x "$BIN_LINK"
    # Don't clean up — the symlink points into CLONE_DIR
    # Disable the cleanup trap since we need the clone to stay
    trap - EXIT
    ok "Manual symlink created: $BIN_LINK"
    warn "Note: do not delete $CLONE_DIR — it's where sicli lives."
    CLONE_DIR=""  # prevent cleanup
  else
    fail "Cannot find entrypoint. Debug:
  ls -la $CLONE_DIR/bin/ 2>/dev/null || echo 'clone dir missing'
  npm prefix -g = $GLOBAL_PREFIX"
  fi
fi

# ── Final verification ──────────────────────────────────────────────

if sicli --help >/dev/null 2>&1; then
  ok "sicli --help works"
else
  fail "sicli is on PATH but crashes on --help.
  Debug: node $(command -v sicli 2>/dev/null || echo 'not found') --help"
fi

echo ""
ok "Installation complete! 🎉"
echo ""
echo "  Quick start:"
echo "    sicli init          # Initialize workspace"
echo "    sicli tui           # Launch TUI mode"
echo "    sicli --help        # Show all commands"
echo ""
echo "  Reinstall anytime:"
echo "    curl -fsSL https://raw.githubusercontent.com/mcpe500/self-improve-cli/main/install.sh | bash"
echo ""

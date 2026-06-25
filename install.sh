#!/usr/bin/env bash
# Installer for sicli — Self-Improving CLI
# Works on Linux, macOS, Windows (Git Bash), and Termux Android.
# https://github.com/mcpe500/self-improve-cli
#
# Strategy: clone → pack tarball → npm install -g tarball → cleanup.
# npm install -g tarball COPIES files permanently (not symlinks),
# so cleanup is safe. npm link from a temp dir is broken because
# the EXIT trap deletes the temp dir → dangling symlink.

set -euo pipefail

REPO_URL="https://github.com/mcpe500/self-improve-cli.git"
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sicli-install-XXXXXX")

# ── Helpers ──────────────────────────────────────────────────────────

info()  { printf '\033[1;34m▸ %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
warn()  { printf '\033[1;33m⚠ %s\033[0m\n' "$1"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

cleanup() { rm -rf "$WORK_DIR" 2>/dev/null || true; }
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
[ -n "$GLOBAL_PREFIX" ] || fail "Cannot determine npm global prefix."

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

# ── Clone → pack → install tarball ──────────────────────────────────

info "Cloning $REPO_URL ..."
git clone --depth 1 "$REPO_URL" "$WORK_DIR/src" 2>&1 || fail "git clone failed."

info "Installing dependencies..."
(cd "$WORK_DIR/src" && npm install --ignore-scripts 2>&1) || fail "npm install failed."

info "Packing tarball..."
(cd "$WORK_DIR/src" && npm pack --ignore-scripts 2>&1) || fail "npm pack failed."

TARBALL=$(ls "$WORK_DIR"/src/self-improve-cli-*.tgz 2>/dev/null | head -n1)
[ -n "$TARBALL" ] || fail "npm pack did not produce a tarball."

info "Installing tarball globally..."
npm install -g "$TARBALL" --ignore-scripts 2>&1 || fail "npm install -g tarball failed."

# ── Cleanup happens automatically via trap EXIT ──────────────────────
# At this point files are COPIED into $MODULE_DIR (not symlinked).
# Safe to delete the temp dir.

# ── Verify AFTER cleanup will happen ────────────────────────────────
# We verify now; the trap fires when we exit (success or fail).
# Since npm install -g tarball copies files, the binary persists
# even after $WORK_DIR is deleted.

if ! command -v sicli >/dev/null 2>&1; then
  fail "sicli not found on PATH after install.
  Debug:
    ls -la $BIN_LINK
    ls -la $MODULE_DIR/bin/ 2>/dev/null || echo 'module dir missing'
    npm prefix -g = $GLOBAL_PREFIX"
fi

ok "sicli found at: $(command -v sicli)"

if ! sicli --help >/dev/null 2>&1; then
  fail "sicli is on PATH but crashes on --help."
fi

ok "sicli --help works"

# ── Done ────────────────────────────────────────────────────────────

echo ""
ok "Installation complete! 🎉"
echo ""
echo "  Quick start:"
echo "    sicli init          # Initialize workspace"
echo "    sicli tui           # Launch TUI mode"
echo "    sicli --help        # Show all commands"
echo ""

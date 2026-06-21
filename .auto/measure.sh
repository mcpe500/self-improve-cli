#!/bin/bash
set -euo pipefail

# Fast pre-checks
if [ ! -f "docs/opencode-benchmark.md" ]; then
  echo "METRIC completeness_score=0"
  echo "METRIC dx_quality_score=0"
  echo "METRIC backward_compat_tests=0"
  echo "METRIC new_tests_added=0"
  echo "METRIC docs_quality_score=0"
  exit 0
fi

# Count implemented P0 features from benchmark doc
completeness=0

# Check TUI header/status (10 points)
if grep -q "mode.*provider.*model.*permission.*cwd" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 10))
fi

# Check Plan/Build modes (15 points)
if [ -f "src/modes.js" ] && grep -q "plan.*build" src/modes.js 2>/dev/null; then
  completeness=$((completeness + 15))
fi

# Check command palette (10 points)
if grep -q "command.*palette\|slash.*registry" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 10))
fi

# Check provider/model picker (10 points)
if grep -q "showProviderPicker\|showModelPicker" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 10))
fi

# Check config local/global (10 points)
if grep -q "local.*global.*config" src/config.js 2>/dev/null; then
  completeness=$((completeness + 10))
fi

# Check permission UX (10 points)
if grep -q "permission.*panel\|showPermissions" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 10))
fi

# Check shell command !cmd (5 points)
if grep -q "^!" src/tui.js 2>/dev/null || grep -q "shellCommand" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 5))
fi

# Check MCP in TUI (5 points)
if grep -q "showMCPMenu" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 5))
fi

# Check skills in TUI (5 points)
if grep -q "showSkillsMenu" src/tui.js 2>/dev/null; then
  completeness=$((completeness + 5))
fi

# Check sessions (5 points)
if [ -f "src/sessions.js" ] || [ -d "src/sessions" ]; then
  completeness=$((completeness + 5))
fi

# Check custom commands (10 points)
if [ -f "src/commands/custom-commands.js" ]; then
  completeness=$((completeness + 10))
fi

# Check backward compat (5 points)
if [ -f "test/backward-compat.test.js" ]; then
  completeness=$((completeness + 5))
fi

# DX Quality Score (subjective assessment)
dx_score=0

# Does TUI feel terminal-native? (check header, status, clean layout)
if grep -q "blessed.box" src/tui.js && grep -q "screen.render" src/tui.js; then
  dx_score=$((dx_score + 2))
fi

# Is feature discovery easy? (command palette, F-keys, help)
if grep -q "F1.*Help\|command.*palette" src/tui.js; then
  dx_score=$((dx_score + 2))
fi

# Are keyboard shortcuts intuitive?
if grep -q "Tab.*switch\|Ctrl+P.*provider" src/tui.js; then
  dx_score=$((dx_score + 2))
fi

# Is status clear?
if grep -q "updateHeader\|statusBar" src/tui.js; then
  dx_score=$((dx_score + 2))
fi

# Documentation quality
if grep -q "workflow\|Quick Start\|Example" docs/opencode-benchmark.md 2>/dev/null; then
  dx_score=$((dx_score + 2))
fi

# Count backward compat tests
backward_tests=0
if [ -f "test/backward-compat.test.js" ]; then
  backward_tests=$(grep -c "^test(" test/backward-compat.test.js 2>/dev/null || echo 0)
fi

# Count new tests added
new_tests=0
for f in test/*.test.js; do
  if [ -f "$f" ]; then
    count=$(grep -c "^test(" "$f" 2>/dev/null || true)
    count=${count:-0}
    new_tests=$((new_tests + count))
  fi
done

# Docs quality score
docs_score=0
if [ -f "docs/opencode-benchmark.md" ]; then
  word_count=$(wc -w < docs/opencode-benchmark.md)
  if [ $word_count -gt 5000 ]; then
    docs_score=10
  elif [ $word_count -gt 3000 ]; then
    docs_score=7
  elif [ $word_count -gt 1000 ]; then
    docs_score=5
  elif [ $word_count -gt 500 ]; then
    docs_score=3
  else
    docs_score=1
  fi
fi

# Output metrics
echo "METRIC completeness_score=$completeness"
echo "METRIC dx_quality_score=$dx_score"
echo "METRIC backward_compat_tests=$backward_tests"
echo "METRIC new_tests_added=$new_tests"
echo "METRIC docs_quality_score=$docs_score"

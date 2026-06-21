# Autoresearch: OpenCode DX Audit & Implementation for self-improve-cli

## Objective

Melakukan audit menyeluruh terhadap OpenCode UI/UX/DX, kemudian meningkatkan self-improve-cli agar mencapai kualitas DX yang sama atau lebih baik, dengan tetap mempertahankan identitas dan arsitektur self-improve-cli.

## Metrics

- **Primary**: `completeness_score` (0-100, higher is better) — persentase fitur P0 OpenCode yang berhasil diimplementasi dengan kualitas baik di self-improve-cli
- **Secondary**: 
  - `dx_quality_score` (0-10) — penilaian subjektif kualitas developer experience
  - `backward_compat_tests` (count) — jumlah test backward compatibility yang pass
  - `new_tests_added` (count) — jumlah test baru yang ditambahkan
  - `docs_quality_score` (0-10) — kualitas dokumentasi

## How to Run

`./.auto/measure.sh` — outputs structured METRIC lines

## Files in Scope

### Documentation (audit & writing)
- `docs/opencode-benchmark.md` — audit menyeluruh OpenCode, mapping fitur, gap analysis
- `README.md` — update dengan fitur baru, workflow explanation
- `README_TUI.md` — enhance dengan fitur Plan/Build, command palette, dll
- `QUICK_START.md` — update workflow

### Core Infrastructure
- `src/config.js` — layered config (local > global > env > defaults)
- `src/config-paths.js` — already done, might need enhancement
- `src/provider.js` — might need enhancement untuk model picker
- `src/provider-registry.js` — already done, might add more providers

### TUI Enhancement
- `src/tui.js` — major upgrade: header dengan status lengkap, command palette, mode indicator, Plan/Build switch, provider/model picker, etc

### New Systems
- `src/modes.js` — Plan/Build mode system
- `src/agents/` — agent registry, custom agents
- `src/commands/custom-commands.js` — markdown-based custom commands
- `src/commands/slash-registry.js` — unified slash command system
- `src/sessions/` — session management
- `src/diagnostics.js` — lightweight diagnostics panel

### Tests
- `test/config-layering.test.js` — test local/global config priority
- `test/modes.test.js` — test Plan/Build modes
- `test/custom-commands.test.js` — test markdown command parsing
- `test/backward-compat.test.js` — ensure old commands still work

## Off Limits

- DO NOT rewrite entire project
- DO NOT break existing commands: `sicli chat`, `sicli swarm`, `sicli self-improve`, etc
- DO NOT add Electron, browser bundles, or heavy dependencies without strong justification
- DO NOT remove or break existing features
- DO NOT hardcode benchmark answers or cheat

## Constraints

1. **Backward Compatibility**: All existing CLI commands must still work
2. **Cross-platform**: Must work on Linux, macOS, Windows, Termux
3. **Plain JavaScript**: No transpilers, keep it simple
4. **Tests Must Pass**: Existing 122 tests + new tests must pass
5. **Incremental**: Work in phases, don't rewrite everything at once
6. **DX Focus**: Every change must improve developer experience, not just add features

## Implementation Priority

### Phase 1: Audit & Planning (P0)
1. Create comprehensive `docs/opencode-benchmark.md`
2. List ALL OpenCode features with references
3. Explain WHY OpenCode DX feels good (not just WHAT features it has)
4. Map OpenCode features → self-improve-cli current state
5. Identify gaps with priority (P0/P1/P2)
6. Create implementation plan

### Phase 2: Core Infrastructure (P0)
1. Enhance config system (already mostly done, verify layering works)
2. Enhance provider/model system
3. Implement Plan/Build modes
4. Create agent system foundation

### Phase 3: TUI Enhancement (P0)
1. Upgrade TUI header with full status (mode, provider, model, permission, cwd, git branch)
2. Add command palette `/`
3. Add mode switcher (Tab for Plan/Build)
4. Add provider/model picker (Ctrl+P)
5. Improve input handling
6. Add status panels

### Phase 4: Advanced Features (P1)
1. Custom commands (markdown-based)
2. Sessions (list/resume/export)
3. Diagnostics panel
4. Plugin hooks

### Phase 5: Polish (P2)
1. Share/export enhancements
2. Server mode improvements
3. IDE integration docs
4. Advanced plugins

## Measurement Criteria

### Completeness Score Calculation

Count P0 features from OpenCode benchmark:
- TUI with proper header/status: 10 points
- Plan/Build modes: 15 points
- Command palette: 10 points
- Provider/model picker: 10 points
- Config local/global: 10 points
- Permission UX: 10 points
- Shell command `!cmd`: 5 points
- MCP integration in TUI: 5 points
- Skills integration in TUI: 5 points
- Sessions basic: 5 points
- Custom commands: 10 points
- Backward compat: 5 points

Total: 100 points possible

### DX Quality Scoring

Subjective assessment (0-10):
- Does TUI feel terminal-native and fast?
- Is feature discovery easy?
- Are keyboard shortcuts intuitive?
- Is status/context always clear?
- Can user switch modes/providers easily?
- Are permissions clear and non-intrusive?
- Does documentation teach workflow, not just list commands?

## What's Been Tried

### Initial State (Before This Session)

✅ Already implemented:
- Basic TUI with blessed (F1-F9 shortcuts)
- Provider registry with 7 providers
- Superpowers feature gates
- Config system (local/global paths)
- Mouse support
- Command history
- Tab completion
- Theme system
- Export/import config
- MCP add/remove in TUI
- 122 tests passing

❌ Missing compared to OpenCode:
- No Plan/Build modes
- No agent system
- No custom commands (markdown-based)
- No proper command palette
- No sessions management
- No `!command` shell execution from TUI
- TUI header doesn't show full status (mode, git branch, permission)
- No diagnostics panel
- No todo/task tracking
- Documentation doesn't explain workflow like OpenCode

### Session Progress

(Will be updated as experiments run)

## Notes for Resuming Agent

If you're resuming this session:
1. Read `docs/opencode-benchmark.md` first to understand what we're building toward
2. Check git log to see what's been implemented
3. Run tests: `npm test`
4. Check TUI: `node bin/self-improve-cli.js tui`
5. Review `.auto/log.jsonl` for what's been tried
6. Check `.auto/ideas.md` for deferred optimizations

# Deferred Ideas for Future Iterations

## P1 Features (Should Have)

### Custom Commands (Markdown-based)
- Parse `.selfimprove/commands/*.md` files
- Support frontmatter: description, agent, model
- Support `$ARGUMENTS`, `$1`, `$2` placeholders
- Support `@file` references
- Add to command palette

### Sessions Management
- Create `src/sessions/` module
- Session create/list/resume/export
- Save transcript to `.selfimprove/sessions/<id>.json`
- Add session picker in TUI (F-key or menu)
- Export to markdown

### Agent Registry
- Create `src/agents/` module
- Define custom agents in config.json
- Agent picker UI
- Per-agent prompt, model, permissions
- Built-in agents: Plan, Build, Explore, Scout

### Tool/Event Panel
- Side panel showing recent tool calls
- Tool name, args, result summary
- Collapsible/expandable
- Real-time updates during agent work

### Diagnostics Panel
- Parse `npm test`, `tsc`, `eslint` output
- Show errors in dedicated panel
- Feed diagnostics to agent context
- Support custom diagnostic commands

### Undo/Redo
- Git snapshot before agent changes
- `/undo` and `/redo` commands
- Show git diff in UI
- Confirm before applying undo

### @file Reference
- Parse `@file.js` in user input
- Attach file content to agent context
- Show attached files in UI
- Support multiple file attachments

## P2 Features (Nice to Have)

### Web UI
- Express server with WebSocket
- React frontend (or simple HTML/vanilla JS)
- Share URL: `http://localhost:3847/web`
- Full parity with TUI features

### IDE Extension
- VS Code extension
- Cursor integration
- Terminal panel in editor
- Context from open files

### LSP Integration
- Optional LSP client
- Diagnostics from language server
- Code intelligence for agent
- Definitions, references, hover

### Advanced Plugin System
- Event hooks: before_tool, after_tool, on_session_start
- Plugin API documentation
- Community plugin registry
- Safe plugin execution (sandboxed?)

### Share Links
- Public session sharing via server
- Privacy controls
- Expiration time
- View-only vs interactive

## Implementation Notes

### Custom Commands Priority
- High impact for user workflows
- Relatively simple to implement
- Start with basic markdown parsing
- Add frontmatter support
- Then add variable substitution

### Sessions Priority
- Essential for long-running work
- Simple JSON storage
- Start with create/list/resume
- Export to markdown for sharing

### Agent Registry
- Medium complexity
- Define schema in config.js
- Agent picker UI in TUI
- Per-agent permission enforcement

### Diagnostics
- Start with simple command output parsing
- Regex for common error patterns
- Feed to agent as structured context
- Optional LSP later

## Performance Considerations

- Keep TUI responsive during agent work (loading indicators help)
- Limit chatHistory size (max 1000 messages?)
- Lazy-load sessions (don't load all on startup)
- Stream tool outputs for large results

## Testing Strategy

- Add backward compat test suite
- Test mode switching with permissions
- Test custom command parsing
- Test session CRUD operations
- Test agent switching
- Test diagnostics parsing

## Documentation Improvements

- Add workflow examples to README
- "How to use Plan mode" guide
- "How to create custom commands" guide
- "How to switch providers" guide
- Video/GIF demos of TUI features

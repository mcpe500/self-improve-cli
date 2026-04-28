---
title: "Skills System"
type: component
status: active
---

# Skills System

## Purpose
Discover, load, and inject SKILL.md instruction modules. Skills optionally provide tool schemas and handlers.

## Location
`src/skills.js`

## Dependencies
- [[state-manager]] for profile overlay (active_skills)

## Interfaces
- `discoverSkills(projectRoot)` — scan 6 directories, return [{ name, description, dir }]
- `parseSkillFrontmatter(content)` — extract name, description, body from SKILL.md
- `loadSkill(skillDir)` — load SKILL.md + optional tools.json + handlers.js
- `enableSkill(root, name)` / `disableSkill(root, name)` — update overlay
- `buildSkillsPrompt(discovered, activeNames)` — format available_skills block
- `getSkillTools(root, activeNames)` — return { schemas, handlers }

## Notes
- 6 discovery dirs: ~/.config/opencode/skills, ~/.claude/skills, ~/.agents/skills (global + project)
- Tool naming: `skill__<name>__<tool>` prefix
- Name validation: ^[a-z0-9]+(-[a-z0-9]+)*$, max 64 chars
- handlers.js loaded via require() — gated by tool_policy (default deny)

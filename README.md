# opencode-self-improve

A minimal, cross-platform starter repo for making an OpenCode setup improve its wrapper over time.

This starter keeps the model fixed and improves the surrounding behavior:
- rules
- skill instructions
- commands
- plugin automation
- evaluation and replay prompts

## Design goals
- Plain JavaScript only
- No Bash, PowerShell, or AppleScript in the core loop
- Works on Linux, macOS, and Windows
- Manual by default
- Optional auto-run on OpenCode idle

## What this measures
This starter scores:
- test commands you configure in `eval/config.json`
- replay prompts you configure in `eval/config.json`

This starter does **not** directly inspect private chain-of-thought. It uses visible output and pass/fail checks as a proxy.

## Files
- `AGENTS.md` project rules for OpenCode
- `.opencode/skills/self-improve/SKILL.md` reusable skill
- `.opencode/commands/evolve.md` manual command in the TUI
- `.opencode/plugins/auto-evolve.js` optional idle automation
- `scripts/evaluate.js` run tests + replay prompts and write a score
- `scripts/evolve.js` evaluate, then ask OpenCode to propose one safe improvement
- `eval/config.json` your benchmark settings

## Manual use
From the repo root:

- `node scripts/evaluate.js`
- `node scripts/evolve.js`

If you use Bun instead of Node:

- `bun scripts/evaluate.js`
- `bun scripts/evolve.js`

Inside OpenCode, you can also use `/evolve`.

## Enable automatic idle runs
Edit `eval/config.json` and set:

```json
{
  "automaticOnIdle": true
}
```

The plugin will stay idle until that flag is true.

## Configure tests
Edit `eval/config.json` and add test commands as arrays:

```json
{
  "tests": [
    ["npm", "test"],
    ["npm", "run", "lint"],
    ["python", "-m", "pytest", "-q"]
  ]
}
```

Use only commands that exist on your machine.

## Configure replay prompts
Edit `eval/config.json` and add prompts you want OpenCode to answer repeatedly.
Each replay can check for required phrases and reward concise output.

## Notes for Windows
This repo avoids platform-specific shell scripts, but OpenCode itself recommends WSL on Windows for the best experience.

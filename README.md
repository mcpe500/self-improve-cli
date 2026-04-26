# self-improve-cli

A minimal, cross-platform starter repo for building a lightweight self-improving agentic coding CLI.

The MVP keeps model/provider work optional and improves the surrounding behavior first:
- JSON profile rules
- tool policy
- durable memory/lessons
- growth gates
- event and patch audit logs

## Design goals
- Plain JavaScript only
- No Bash, PowerShell, or AppleScript in the core loop
- Works on Linux, macOS, and Windows
- Manual by default
- Optional auto-apply only when profile growth policy allows it
- Low memory: no Electron, no default indexer, no LSP/embeddings/watchers by default

## What this runs

Current MVP can run an interactive coding chat loop, call local tools, and record observed failures into `.selfimprove/events.jsonl`. Tests validate profile, config, and tool behavior.

## Files
- `AGENTS.md` project rules for agents working in this repo
- `bin/self-improve-cli.js` zero-dependency CLI entrypoint
- `src/profile.js` profile validation, prompt compilation, JSON patch, growth gates
- `src/state.js` `.selfimprove/` state, event log, patch audit, overlay mutation
- `src/config.js` provider/model config in `.selfimprove/config.json`
- `src/provider.js` OpenAI-compatible Chat Completions client
- `src/agent.js` chat loop and tool-call dispatcher
- `src/tools.js` lightweight file read, search, command, and exact edit tools
- `profiles/default.profile.json` immutable default profile template
- `test/profile.test.js` built-in Node tests
- `spec-driven-llm-wiki/` spec-driven project memory

## Manual use
From the repo root:

```bash
npm test
node bin/self-improve-cli.js init
node bin/self-improve-cli.js status
node bin/self-improve-cli.js config show
node bin/self-improve-cli.js profile --prompt
node bin/self-improve-cli.js improve --type failure --message "edited file without reading context first"
node bin/self-improve-cli.js improve --type failure --message "edited file without reading context first" --apply
```

Optional local install:

```bash
npm link
sicli status
```

## Chat setup

Set provider config. API key stays in env; it is not written to config.

```bash
node bin/self-improve-cli.js config set model gpt-4o-mini
node bin/self-improve-cli.js config set api_key_env OPENAI_API_KEY
node bin/self-improve-cli.js config set base_url https://api.openai.com/v1
```

Start one-shot chat:

```bash
node bin/self-improve-cli.js chat "read README and summarize this project"
```

Start interactive chat:

```bash
node bin/self-improve-cli.js chat
# or after npm link:
sicli
```

Inside chat, configure provider/model before first prompt. `/connect` asks for API key with hidden input and stores it in `.selfimprove/secrets.json`.

```text
sicli> /connect
sicli> /connect minimax
API key for MiniMax Coding Plan (empty to skip): 
sicli> /connect zai
API key for Z.AI Coding Plan (empty to skip): 
sicli> /key
sicli> /models
sicli> /models MiniMax-M2.7-highspeed
sicli> /models GLM-5.1
sicli> /config
```

Built-in provider presets:

| Provider | Base URL | API key env | Models |
| --- | --- | --- | --- |
| OpenAI Compatible | `https://api.openai.com/v1` | `OPENAI_API_KEY` | `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1` |
| MiniMax Coding Plan | `https://api.minimax.io/v1` | `MINIMAX_API_KEY` | `MiniMax-M2.7`, `MiniMax-M2.7-highspeed` |
| Z.AI Coding Plan | `https://api.z.ai/api/coding/paas/v4` | `ZAI_API_KEY` | `GLM-5.1`, `GLM-5`, `GLM-5-Turbo`, `GLM-4.7`, `GLM-4.5-air` |

Secret storage:

- API keys are stored in `.selfimprove/secrets.json`, never `.selfimprove/config.json`.
- `.selfimprove/` is gitignored.
- CLI applies best-effort permissions: directory `0700`, secret file `0600`.
- `/config` only shows `stored_api_key: true/false`, not the key.
- Env vars still work as fallback, but are no longer required.

Commands that need approval, such as `run_command`, require interactive approval or `--yes`:

```bash
node bin/self-improve-cli.js chat --yes "run tests and report result"
```

## Growth policy

Active profile lives in `.selfimprove/base.profile.json` + `.selfimprove/overlay.profile.json`.

- `none`: no profile mutation
- `low`: propose only; human may apply safe patches
- `medium`: can auto-apply safe rule/memory patches when `auto_apply=true`
- `high`: can also patch style/tool policy
- `very_high`: broader patch surface, still protected from self-escalating growth level

Change local growth level:

```bash
node bin/self-improve-cli.js growth medium --auto-apply true
```

## Coding tools

```bash
node bin/self-improve-cli.js tool read README.md
node bin/self-improve-cli.js tool search profile .
node bin/self-improve-cli.js tool run npm test
node bin/self-improve-cli.js tool edit README.md old_text new_text
```

`tool run` uses `child_process.spawn` with `shell: false`.

## Notes for Windows
This repo avoids platform-specific shell scripts and runs with Node.js on Windows, Linux, and macOS.

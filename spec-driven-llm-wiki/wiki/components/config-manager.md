---
title: "Config Manager"
type: component
tags: [config, provider, presets, permissions]
last_updated: 2026-04-28
---

# Config Manager

`[[components/config-manager]]` tracks provider configuration, permission modes, and runtime settings persisted to `.selfimprove/config.json`.

## Responsibilities

- Provide `loadConfig(root)` — initialize workspace, read or create config, normalize and return.
- Validate and normalize all fields via `normalizeConfig(config)` — type-checks every key, enforces permission mode enum, clamps integers positive.
- Ship three `PROVIDER_PRESETS`: OpenAI Compatible (`gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1`), MiniMax Coding Plan (`MiniMax-M2.7`, `MiniMax-M2.7-highspeed`), Z.AI Coding Plan (`GLM-5.1`, `GLM-5`, `GLM-5-Turbo`, `GLM-4.7`, `GLM-4.5-air`).
- Resolve presets by id, label substring, or 1-based index via `findProviderPreset(value)`.
- Connect a provider with `connectProvider(root, providerRef)` — updates provider fields and resets model to first preset model.
- Enumerate and set permission modes: `secure`, `partial_secure`, `ai_reviewed`, `auto_approve`.
- Persist changes through `saveConfig(root, config)` and `setConfigValue(root, key, value)` with auto-parsing of booleans and numbers.
- Resolve model lists via `modelsForConfig(config)` and set active model via `setModel(root, model)`.
- Apply environment variable overrides: `SICLI_BASE_URL`, `SICLI_API_KEY_ENV`, `SICLI_MODEL`, `SICLI_PERMISSION_MODE`.

## Key Defaults

- `temperature`: 0.2
- `max_tool_turns`: 8 (normal), `max_tool_turns_autonomous`: 50
- `max_history_messages`: 20
- `self_improve_background`: true
- `self_improve_review_every`: 1 (review after every new trace)
- `ask_gate_enabled`: false

## Constraints

- Config stored at `.selfimprove/config.json`; secrets stored separately in `.selfimprove/secrets.json`.
- `normalizeConfig` throws on missing or wrong-typed fields; no silent defaults for invalid input.
- Permission mode must be one of the four enum values or `normalizeConfig` rejects.
- API keys are never stored in config — only the environment variable name (`api_key_env`) is persisted.
- No external dependencies; uses `node:fs/promises` and `node:path` only.

## Related

- [[components/provider-client]]
- [[components/profile-engine]]
- [[components/lightweight-cli-core]]

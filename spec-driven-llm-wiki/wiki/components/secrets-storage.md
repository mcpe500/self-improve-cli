---
title: "Secrets Storage"
type: component
tags: [secrets, api-key, security, permissions]
last_updated: 2026-04-28
---

# Secrets Storage

`[[components/secrets-storage]]` tracks secure API key storage with filesystem permissions.

## Responsibilities

- `setProviderApiKey(root, providerId, apiKey)` — store a provider API key to `.selfimprove/secrets.json` with timestamp.
- `getProviderApiKey(root, providerId)` — retrieve stored API key; returns empty string if not found.
- `hasProviderApiKey(root, providerId)` — boolean check for key existence.
- `loadSecrets(root)` — read and parse secrets file; ensures `providers` object structure.
- `saveSecrets(root, secrets)` — write normalized secrets JSON with file mode `0o600`.
- `secretStatus(root, config)` — return `{ provider_id, stored_api_key (boolean), secrets_file }` for display.
- `secureStateDir(root)` — ensure `.selfimprove/` directory exists with `chmod 0o700`.

## Constraints

- Secrets stored only in `.selfimprove/secrets.json`, never in `config.json`.
- Directory permissions `0o700`, file permissions `0o600` (best-effort on Windows).
- `saveSecrets` applies `chmod` after write as fallback for restricted filesystems.
- Provider ID is normalized (trimmed, non-empty) before storage.
- API key cannot be empty on `setProviderApiKey`.
- File writes use `{ mode: 0o600 }` option for creation-time permissions.
- No dependency added; uses `[[components/state-manager]]` for `statePath` and `initWorkspace`.

## Related

- [[components/provider-client]]
- [[components/config-manager]]
- [[components/state-manager]]

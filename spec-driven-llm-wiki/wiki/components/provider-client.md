---
title: "Provider Client"
type: component
tags: [provider, openai, api, completion]
last_updated: 2026-04-28
---

# Provider Client

`[[components/provider-client]]` tracks OpenAI-compatible Chat Completions API calls and key resolution.

## Responsibilities

- Send Chat Completions requests via native `fetch` to any OpenAI-compatible endpoint via `chatCompletion`.
- Resolve API keys through `apiKeyFromConfig` with fallback chain: stored secrets file → environment variable → throw.
- Construct properly formed API URLs via `joinUrl` (strips trailing/leading slashes and joins).
- Combine multiple `AbortSignal` sources (timeout + caller signal) via `anySignal` helper.
- Parse JSON responses, extract `choices[0].message` and `usage` from provider response.
- Report provider errors with status code and message from response body.

## Key Exports

- `chatCompletion(root, config, messages, tools, signal)` — sends a Chat Completions request. Returns `{ message, usage }`. Accepts optional `tools` array for function-calling and an `AbortSignal`.
- `joinUrl(baseUrl, suffix)` — joins URL segments, normalizing slashes. Returns a single URL string.
- `apiKeyFromConfig(root, config, env)` — resolves API key from stored secrets (`getProviderApiKey`) then environment (`config.api_key_env`). Throws with actionable error message on failure.

## Request Shape

- Method: `POST` to `<base_url>/chat/completions`.
- Headers: `content-type: application/json`, `authorization: Bearer <api_key>`.
- Body: `{ model, temperature, messages, tools?, tool_choice? }`.
- `tools` and `tool_choice: "auto"` are included only when a non-empty tools array is provided.

## Constraints

- Only supports `openai-compatible` provider type; throws for any other `config.provider` value.
- Default timeout is 30000ms, configurable via `config.timeout_ms`.
- Response parsing handles empty bodies (`{}`) and non-JSON responses (`{ raw: text }`).
- Throws on non-ok responses with `Provider error <status>: <message>`.
- Throws on missing `choices[0].message` in successful responses.
- API keys are never passed via config; always resolved through `[[components/secrets]]` or environment.
- Uses native `fetch` — no HTTP library dependency.
- `anySignal` creates a composite `AbortController` that aborts when any input signal fires.

## Related

- [[components/agent-chat-loop]]
- [[components/autonomous-mode-ask-gate]]
- [[components/swarm-orchestrator]]
- [[components/mmx-tools]]

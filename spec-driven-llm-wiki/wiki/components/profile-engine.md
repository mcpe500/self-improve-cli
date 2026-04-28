---
title: "Profile Engine"
type: component
tags: [profile, json-patch, growth, harness]
last_updated: 2026-04-28
---

# Profile Engine

`[[components/profile-engine]]` tracks profile validation, compilation, JSON patching, growth gate evaluation, and static lesson suggestion.

## Responsibilities

- Validate profile structure via `validateProfile(profile, label)` — checks `id`, `version`, `style`, `rules`, `tool_policy`, `memory`, `growth`, `harness` with strict type rules.
- Compile profile into a system-prompt string via `compileProfilePrompt(profile)` — serializes style, rules, tool policy, memory (last 20 lessons), and growth config.
- Implement RFC 6902–style JSON Patch via `applyJsonPatch(document, patch)` — supports `add`, `replace`, `remove` ops with JSON Pointer path resolution and `~0`/`~1` decoding.
- Evaluate whether a patch is allowed via `evaluatePatch(profile, patch, options)` — checks growth level, max ops, protected fields, and auto-apply eligibility.
- Suggest patches from observed events via `suggestPatchFromEvent(event)` — pattern-matches failure messages to propose rules, lessons, user preferences, or project facts.
- Merge overlay onto base via `deepMerge(base, overlay)` — arrays concatenate, objects recurse, scalars overwrite.

## Growth Levels and Allowed Paths

| Level | Patchable Paths |
|-------|----------------|
| `none` | Nothing — all patches rejected |
| `low` | `/rules`, `/memory/lessons`, `/memory/user_preferences`, `/memory/project_facts` |
| `medium` | Same as low |
| `high` | `/rules`, `/memory`, `/style`, `/tool_policy` |
| `very_high` | `/description`, `/style`, `/rules`, `/tool_policy`, `/memory`, `/growth/requires_eval`, `/growth/max_patch_ops`, `/growth/rollback` |

## Protected Fields

`/id`, `/version`, `/growth/level`, `/growth/auto_apply`, `/growth/max_patch_ops` are never patchable regardless of level.

## Constraints

- `base.profile.json` is immutable; only `overlay.profile.json` is mutated via patches.
- All patch changes logged to `.selfimprove/patches.jsonl` by `[[components/state-manager]]`.
- `max_patch_ops` limits patch size per iteration (default from profile growth config).
- Lessons capped to last 20 in compiled prompt to prevent context bloat.
- No external dependencies.

## Related

- [[components/config-manager]]
- [[components/state-manager]]
- [[components/lightweight-cli-core]]

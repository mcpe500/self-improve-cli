---
title: "Growth Gate"
type: pattern
tags: [self-improve, safety, permissions]
last_updated: 2026-04-28
---

# Growth Gate

`[[patterns/growth-gate]]` describes a level-based permission system controlling which profile paths the self-improve engine may patch.

## Pattern

Profile paths are grouped into sensitivity tiers. A growth level setting determines the maximum tier the engine is allowed to modify. Patches targeting paths above the current level are rejected.

## When To Use

- Self-improve engine proposing profile patches.
- Any automated mutation of configuration that needs graduated trust.

## Implementation

| Level | Allowed paths |
|-------|---------------|
| none | Blocked — no patches |
| low | `rules`, `lessons` |
| medium | + `memory` |
| high | + `style`, `tool_policy` |
| very_high | + `growth` (meta-learning) |

1. Patch proposal includes target path.
2. Growth gate checks path against current level.
3. Reject patches targeting disallowed paths.
4. `base.profile.json` is always immutable regardless of level.

## Related

- [[components/self-improve-engine]]
- [[components/profile-engine]]

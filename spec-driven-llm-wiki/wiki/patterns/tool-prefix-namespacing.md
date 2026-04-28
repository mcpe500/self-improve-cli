---
title: "Tool Prefix Namespacing"
type: pattern
---

# Tool Prefix Namespacing

## Problem
External tools from MCP servers and skills may collide with built-in tools or each other.

## Solution
Prefix all external tool names with namespace:
- MCP: `mcp__<serverName>__<toolName>`
- Skills: `skill__<skillName>__<toolName>`

Double underscore separator. Namespace parsed at dispatch time: `name.split('__')` → [type, namespace, tool].

## Examples
- `mcp__filesystem__read_file` — MCP filesystem server's read_file tool
- `skill__caveman__compress` — caveman skill's compress tool
- Built-in `read_file` — no prefix, handled by hardcoded dispatch

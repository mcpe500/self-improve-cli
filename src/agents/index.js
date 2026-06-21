'use strict';

/**
 * Agent Registry - Built-in and custom agents
 *
 * Agents are presets combining a prompt, model, and permission set.
 * Built-in agents mirror OpenCode's Plan/Build/Explore/Scout pattern.
 */

const { MODES, getModePermissions } = require('../modes');

const BUILT_IN_AGENTS = {
  plan: {
    name: 'plan',
    description: 'Read-only planning and analysis agent. Safe for exploration.',
    mode: MODES.PLAN,
    color: 'cyan',
    systemPrompt: 'You are a planning agent. Analyze the codebase, propose changes, and explain trade-offs. Do NOT edit files unless explicitly asked.',
    defaultModel: null,
  },
  build: {
    name: 'build',
    description: 'Implementation agent. Can edit files and run commands per user permissions.',
    mode: MODES.BUILD,
    color: 'green',
    systemPrompt: 'You are an implementation agent. Make focused, minimal changes. Verify with tests when possible.',
    defaultModel: null,
  },
  explore: {
    name: 'explore',
    description: 'Fast read-only agent for exploring the codebase.',
    mode: MODES.PLAN,
    color: 'blue',
    systemPrompt: 'You are an exploration agent. Read files, search code, and report findings concisely. Do NOT make changes.',
    defaultModel: null,
  },
  scout: {
    name: 'scout',
    description: 'External research agent. Read-only, for docs and dependencies.',
    mode: MODES.PLAN,
    color: 'magenta',
    systemPrompt: 'You are a research agent. Investigate external docs, dependencies, and patterns. Report findings only.',
    defaultModel: null,
  },
};

/**
 * List built-in agent names.
 */
function listBuiltInAgentNames() {
  return Object.keys(BUILT_IN_AGENTS);
}

/**
 * Get a built-in agent definition.
 */
function getBuiltInAgent(name) {
  return BUILT_IN_AGENTS[name] || null;
}

/**
 * List custom agents from config.
 */
function listCustomAgents(config = {}) {
  const agents = config.agents || {};
  return Object.entries(agents).map(([name, def]) => ({
    name,
    description: def.description || 'Custom agent',
    mode: def.mode || MODES.BUILD,
    color: def.color || 'white',
    systemPrompt: def.system_prompt || def.prompt || '',
    defaultModel: def.model || null,
    custom: true,
  }));
}

/**
 * List all agents (built-in + custom).
 */
function listAllAgents(config = {}) {
  const builtIn = Object.values(BUILT_IN_AGENTS);
  const custom = listCustomAgents(config);
  return [...builtIn, ...custom];
}

/**
 * Get a specific agent by name.
 */
function getAgent(name, config = {}) {
  if (BUILT_IN_AGENTS[name]) return BUILT_IN_AGENTS[name];
  const custom = listCustomAgents(config).find((a) => a.name === name);
  return custom || null;
}

/**
 * Resolve effective agent settings given config.
 */
function resolveAgent(name, config = {}) {
  const agent = getAgent(name, config);
  if (!agent) return null;

  return {
    name: agent.name,
    description: agent.description,
    mode: agent.mode,
    color: agent.color,
    systemPrompt: agent.systemPrompt,
    model: agent.defaultModel || config.active_model || null,
    permissions: getModePermissions(agent.mode, config.permission_mode ? { _base: config.permission_mode } : {}),
  };
}

/**
 * Get agent by @mention from text.
 * Returns { agent, text } where text has @mention removed.
 */
function parseAgentMention(text) {
  const match = text.match(/^@(\w+)\s+(.*)$/s);
  if (!match) return { agent: null, text };
  return { agent: match[1], text: match[2] };
}

module.exports = {
  BUILT_IN_AGENTS,
  listBuiltInAgentNames,
  getBuiltInAgent,
  listCustomAgents,
  listAllAgents,
  getAgent,
  resolveAgent,
  parseAgentMention,
};

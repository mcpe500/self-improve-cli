'use strict';

/**
 * Superpowers: capability gates for features.
 * Each superpower can be enabled/disabled in config.
 */

const SUPERPOWERS = {
  chat: {
    name: 'chat',
    label: 'Chat',
    description: 'Interactive chat with agent',
    default: true,
  },
  tools: {
    name: 'tools',
    label: 'Tools',
    description: 'File operations and shell commands',
    default: true,
  },
  self_improve: {
    name: 'self_improve',
    label: 'Self-Improve',
    description: 'Self-improvement pipeline',
    default: true,
  },
  swarm: {
    name: 'swarm',
    label: 'Swarm',
    description: 'Multi-agent swarm orchestration',
    default: true,
  },
  skills: {
    name: 'skills',
    label: 'Skills',
    description: 'Plugin skills system',
    default: true,
  },
  mcp: {
    name: 'mcp',
    label: 'MCP',
    description: 'Model Context Protocol tools',
    default: true,
  },
  autonomous: {
    name: 'autonomous',
    label: 'Autonomous',
    description: 'Autonomous mode with dont-ask gate',
    default: false,
  },
  planning: {
    name: 'planning',
    label: 'Planning',
    description: 'Planning and task decomposition',
    default: true,
  },
  history: {
    name: 'history',
    label: 'History',
    description: 'History tracking and replay',
    default: true,
  },
  vision: {
    name: 'vision',
    label: 'Vision',
    description: 'Image input support (model-dependent)',
    default: false,
  },
};

const PRESETS = {
  safe: {
    name: 'safe',
    label: 'Safe',
    description: 'Read-only operations, no autonomous execution',
    powers: {
      chat: true,
      tools: false,
      self_improve: false,
      swarm: false,
      skills: false,
      mcp: false,
      autonomous: false,
      planning: true,
      history: true,
      vision: false,
    },
  },
  balanced: {
    name: 'balanced',
    label: 'Balanced',
    description: 'Moderate capabilities, manual approval for risky actions',
    powers: {
      chat: true,
      tools: true,
      self_improve: true,
      swarm: true,
      skills: true,
      mcp: true,
      autonomous: false,
      planning: true,
      history: true,
      vision: false,
    },
  },
  power: {
    name: 'power',
    label: 'Power',
    description: 'All features enabled (respects permission mode)',
    powers: {
      chat: true,
      tools: true,
      self_improve: true,
      swarm: true,
      skills: true,
      mcp: true,
      autonomous: true,
      planning: true,
      history: true,
      vision: true,
    },
  },
};

function getDefaultSuperpowers() {
  const powers = {};
  for (const [key, def] of Object.entries(SUPERPOWERS)) {
    powers[key] = def.default;
  }
  return powers;
}

function validateSuperpowers(powers) {
  if (!powers || typeof powers !== 'object') {
    return { valid: false, errors: ['superpowers must be an object'] };
  }
  const errors = [];
  for (const key of Object.keys(powers)) {
    if (!SUPERPOWERS[key]) {
      errors.push(`Unknown superpower: ${key}`);
    }
    if (typeof powers[key] !== 'boolean') {
      errors.push(`Superpower ${key} must be boolean`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function applyPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return { ...preset.powers };
}

function isEnabled(config, powerName) {
  if (!config.superpowers) return SUPERPOWERS[powerName]?.default ?? false;
  return config.superpowers[powerName] ?? SUPERPOWERS[powerName]?.default ?? false;
}

function listSuperpowers() {
  return Object.values(SUPERPOWERS);
}

function listPresets() {
  return Object.values(PRESETS);
}

module.exports = {
  SUPERPOWERS,
  PRESETS,
  getDefaultSuperpowers,
  validateSuperpowers,
  applyPreset,
  isEnabled,
  listSuperpowers,
  listPresets,
};

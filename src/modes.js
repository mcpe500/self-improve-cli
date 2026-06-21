'use strict';

/**
 * Plan/Build Mode System
 * 
 * OpenCode-inspired mode system for safe exploration vs implementation.
 * 
 * - Plan mode: read-only, safe for exploration, analysis, and planning
 * - Build mode: implementation mode, can edit/write based on permissions
 * 
 * Mode affects tool permissions and agent behavior.
 */

const MODES = {
  PLAN: 'plan',
  BUILD: 'build',
};

const MODE_LABELS = {
  [MODES.PLAN]: 'PLAN',
  [MODES.BUILD]: 'BUILD',
};

const MODE_DESCRIPTIONS = {
  [MODES.PLAN]: 'Read-only mode: analyze, explore, and plan safely without making changes',
  [MODES.BUILD]: 'Implementation mode: edit, write, and execute based on your permission settings',
};

/**
 * Get tool permissions for a given mode.
 * Plan mode restricts write/edit/destructive operations.
 * Build mode allows operations based on permission_mode.
 * 
 * @param {string} mode - 'plan' or 'build'
 * @param {object} basePermissions - base permissions from config/permission_mode
 * @returns {object} effective permissions for the mode
 */
function getModePermissions(mode, basePermissions = {}) {
  if (mode === MODES.PLAN) {
    // Plan mode: read-only
    return {
      read: 'allow',
      search: 'allow',
      grep: 'allow',
      glob: 'allow',
      write: 'deny',
      edit: 'deny',
      run_command: 'ask', // Allow with explicit approval
      bash: 'ask',
      webfetch: 'ask',
      websearch: 'ask',
      mcp: 'ask',
      skill: 'allow',
      question: 'allow',
    };
  }

  if (mode === MODES.BUILD) {
    // Build mode: use base permissions from permission_mode
    return basePermissions;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

/**
 * Check if a tool is allowed in the current mode.
 * 
 * @param {string} toolName - name of the tool
 * @param {string} mode - current mode
 * @param {object} basePermissions - base permissions
 * @returns {string} 'allow', 'ask', or 'deny'
 */
function checkToolPermission(toolName, mode, basePermissions) {
  const modePerms = getModePermissions(mode, basePermissions);
  return modePerms[toolName] || 'ask';
}

/**
 * Validate mode value.
 * 
 * @param {string} mode
 * @returns {boolean}
 */
function isValidMode(mode) {
  return mode === MODES.PLAN || mode === MODES.BUILD;
}

/**
 * Get default mode from config or fallback.
 * 
 * @param {object} config
 * @returns {string}
 */
function getDefaultMode(config = {}) {
  const configMode = config.default_mode || config.mode;
  if (configMode && isValidMode(configMode)) {
    return configMode;
  }
  return MODES.BUILD; // Default to Build for backward compatibility
}

/**
 * Switch to a different mode.
 * Returns new mode and description.
 * 
 * @param {string} currentMode
 * @returns {object} { mode, description }
 */
function switchMode(currentMode) {
  const newMode = currentMode === MODES.PLAN ? MODES.BUILD : MODES.PLAN;
  return {
    mode: newMode,
    description: MODE_DESCRIPTIONS[newMode],
  };
}

/**
 * Get mode display info for TUI.
 * 
 * @param {string} mode
 * @returns {object} { label, description, color }
 */
function getModeDisplay(mode) {
  return {
    label: MODE_LABELS[mode] || mode.toUpperCase(),
    description: MODE_DESCRIPTIONS[mode] || '',
    color: mode === MODES.PLAN ? 'cyan' : 'green',
  };
}

module.exports = {
  MODES,
  MODE_LABELS,
  MODE_DESCRIPTIONS,
  getModePermissions,
  checkToolPermission,
  isValidMode,
  getDefaultMode,
  switchMode,
  getModeDisplay,
};

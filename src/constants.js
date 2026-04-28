'use strict';

/**
 * Centralized constants for self-improve-cli.
 * All tunable numeric values live here.
 */

module.exports = {
  // Timeouts (ms)
  MCP_TIMEOUT_MS: 30000,
  PROVIDER_TIMEOUT_MS: 30000,
  COMMAND_TIMEOUT_MS: 120000,
  MMX_TIMEOUT_MS: 30000,

  // Limits
  COMPACT_LIMIT: 12000,
  MAX_FILE_READ_BYTES: 128 * 1024,
  MAX_SEARCH_RESULTS: 100,
  MAX_HISTORY_MESSAGES: 20,
  MAX_TOOL_TURNS: 8,
  MAX_TOOL_TURNS_AUTONOMOUS: 50,
  DEFERRED_QUESTION_BUDGET: 5,

  // Daemon
  DAEMON_PORT: 3847,
  DAEMON_INTERVAL_MINUTES: 15,
  DAEMON_ERROR_THRESHOLD: 5,

  // Swarm
  SWARM_CONCURRENCY: 3,
  SWARM_MAX_CRITIC_ITERATIONS: 1,
  SWARM_MAX_TURNS: 25,

  // Self-improve
  MAX_PATCH_OPS: 3,
  MAX_CANDIDATE_AGE_DAYS: 30,
  BACKUP_CHAIN_DEPTH: 3,

  // Profile / Skills
  MAX_SKILL_NAME_LENGTH: 64,

  // Provider defaults
  DEFAULT_TEMPERATURE: 0.2,
  DEFAULT_PERMISSION_MODE: 'partial_secure',

  // Regex
  SKILL_NAME_RE: /^[a-z0-9]+(-[a-z0-9]+)*$/,
};

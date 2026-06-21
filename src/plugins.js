'use strict';

/**
 * Plugin Hooks - Lightweight event system
 *
 * Plugins register handlers for lifecycle events.
 * Safe failure: plugin errors never crash the app.
 */

const VALID_EVENTS = [
  'before_tool',
  'after_tool',
  'before_agent',
  'after_agent',
  'on_session_start',
  'on_session_end',
  'on_config_change',
];

const handlers = new Map();

/**
 * Register a handler for an event.
 */
function on(event, handler) {
  if (!VALID_EVENTS.includes(event)) {
    throw new Error(`Unknown event: ${event}. Valid: ${VALID_EVENTS.join(', ')}`);
  }
  if (typeof handler !== 'function') {
    throw new Error('Handler must be a function');
  }
  if (!handlers.has(event)) {
    handlers.set(event, []);
  }
  handlers.get(event).push(handler);
}

/**
 * Emit an event. Handlers run in sequence; errors are swallowed.
 * Returns array of results from handlers that returned values.
 */
async function emit(event, payload = {}) {
  if (!VALID_EVENTS.includes(event)) return [];
  const eventHandlers = handlers.get(event) || [];
  const results = [];

  for (const handler of eventHandlers) {
    try {
      const result = await handler(payload);
      if (result !== undefined) results.push(result);
    } catch (error) {
      // Swallow error — plugins must not crash core
      console.error(`[plugin] ${event} handler error: ${error.message}`);
    }
  }

  return results;
}

/**
 * Clear all handlers (for testing).
 */
function clear() {
  handlers.clear();
}

/**
 * List registered events.
 */
function listEvents() {
  return [...handlers.keys()].filter((e) => handlers.get(e).length > 0);
}

/**
 * Count handlers for an event.
 */
function handlerCount(event) {
  return (handlers.get(event) || []).length;
}

/**
 * Load hooks from config.
 * Config format:
 * {
 *   "hooks": {
 *     "before_tool": ["/path/to/hook.js", "npm run check"],
 *     "after_tool": []
 *   }
 * }
 */
function loadFromConfig(config = {}) {
  const hooks = config.hooks || {};
  let loaded = 0;

  for (const [event, entries] of Object.entries(hooks)) {
    if (!VALID_EVENTS.includes(event)) continue;
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (typeof entry === 'string') {
        // Command string — register a handler that runs it
        on(event, async (payload) => {
          const { spawn } = require('node:child_process');
          return new Promise((resolve) => {
            const [cmd, ...args] = entry.split(/\s+/);
            const proc = spawn(cmd, args, {
              shell: false,
              env: { ...process.env, SICLI_EVENT: event, SICLI_PAYLOAD: JSON.stringify(payload).slice(0, 4096) },
            });
            proc.on('close', resolve);
            proc.on('error', resolve);
          });
        });
        loaded++;
      } else if (typeof entry === 'function') {
        on(event, entry);
        loaded++;
      }
    }
  }

  return loaded;
}

module.exports = {
  VALID_EVENTS,
  on,
  emit,
  clear,
  listEvents,
  handlerCount,
  loadFromConfig,
};

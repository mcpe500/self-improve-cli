'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const STATE_DIR = '.selfimprove';
const BASE_PROFILE = 'base.profile.json';
const OVERLAY_PROFILE = 'overlay.profile.json';
const EVENTS_LOG = 'events.jsonl';
const PATCHES_LOG = 'patches.jsonl';
const TRACES_LOG = 'traces.jsonl';
const OPTIMIZER_STATE = 'optimizer.json';
const DAEMON_STATE = 'daemon.json';
const DAEMON_PID = 'daemon.pid';
const MCP_CONFIG = 'mcp.json';
const HISTORY_LOG = 'history.jsonl';

function statePath(root, file = '') {
  return path.join(root, STATE_DIR, file);
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback = undefined) {
  if (!(await exists(file))) return fallback;
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

// Save current state snapshot (for revert)
async function saveState(root) {
  const stateFile = statePath(root, 'current_state.json');
  const configFile = statePath(root, 'config.json');
  const overlayFile = statePath(root, OVERLAY_PROFILE);

  const state = {
    timestamp: new Date().toISOString(),
    config: await readJson(configFile, {}),
    overlay: await readJson(overlayFile, null)
  };

  await writeJson(stateFile, state);

  // Append to history
  const historyFile = statePath(root, HISTORY_LOG);
  const historyEntry = { timestamp: state.timestamp, type: 'snapshot', state };
  await fs.appendFile(historyFile, JSON.stringify(historyEntry) + '\n');

  return state;
}

// Load state snapshot
async function loadState(root) {
  const stateFile = statePath(root, 'current_state.json');
  return readJson(stateFile, null);
}

module.exports = {
  STATE_DIR,
  BASE_PROFILE,
  OVERLAY_PROFILE,
  EVENTS_LOG,
  PATCHES_LOG,
  TRACES_LOG,
  OPTIMIZER_STATE,
  DAEMON_STATE,
  DAEMON_PID,
  MCP_CONFIG,
  HISTORY_LOG,
  statePath,
  exists,
  readJson,
  writeJson,
  saveState,
  loadState
};

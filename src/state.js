'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { deepMerge, validateProfile, applyJsonPatch } = require('./profile');

const STATE_DIR = '.selfimprove';
const BASE_PROFILE = 'base.profile.json';
const OVERLAY_PROFILE = 'overlay.profile.json';
const EVENTS_LOG = 'events.jsonl';
const PATCHES_LOG = 'patches.jsonl';

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

async function initWorkspace(root = process.cwd()) {
  const dir = statePath(root);
  await fs.mkdir(dir, { recursive: true });
  const defaultProfilePath = path.resolve(__dirname, '..', 'profiles', 'default.profile.json');
  const basePath = statePath(root, BASE_PROFILE);
  const overlayPath = statePath(root, OVERLAY_PROFILE);
  if (!(await exists(basePath))) {
    const base = await readJson(defaultProfilePath);
    validateProfile(base, 'default profile');
    await writeJson(basePath, base);
  }
  if (!(await exists(overlayPath))) {
    await writeJson(overlayPath, {
      style: {},
      rules: [],
      tool_policy: {},
      memory: {
        user_preferences: [],
        project_facts: [],
        lessons: []
      },
      growth: {}
    });
  }
  for (const file of [EVENTS_LOG, PATCHES_LOG]) {
    const target = statePath(root, file);
    if (!(await exists(target))) await fs.writeFile(target, '', 'utf8');
  }
  return dir;
}

async function loadProfiles(root = process.cwd()) {
  await initWorkspace(root);
  const base = await readJson(statePath(root, BASE_PROFILE));
  const overlay = await readJson(statePath(root, OVERLAY_PROFILE), {});
  validateProfile(base, 'base profile');
  const active = deepMerge(base, overlay);
  validateProfile(active, 'active profile');
  return { base, overlay, active };
}

async function saveOverlay(root, overlay) {
  await writeJson(statePath(root, OVERLAY_PROFILE), overlay);
}

async function appendJsonLine(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, 'utf8');
}

async function appendEvent(root, event) {
  const record = {
    ts: new Date().toISOString(),
    ...event
  };
  await appendJsonLine(statePath(root, EVENTS_LOG), record);
  return record;
}

async function appendPatchAudit(root, audit) {
  const record = {
    ts: new Date().toISOString(),
    ...audit
  };
  await appendJsonLine(statePath(root, PATCHES_LOG), record);
  return record;
}

async function applyPatchToOverlay(root, patch) {
  const { base, overlay } = await loadProfiles(root);
  const nextOverlay = applyJsonPatch(overlay, patch);
  const active = deepMerge(base, nextOverlay);
  validateProfile(active, 'active profile after patch');
  await saveOverlay(root, nextOverlay);
  return { overlay: nextOverlay, active };
}

async function setGrowthLevel(root, level, options = {}) {
  const { overlay } = await loadProfiles(root);
  const growth = { level };
  if (typeof options.auto_apply === 'boolean') growth.auto_apply = options.auto_apply;
  const nextOverlay = deepMerge(overlay, { growth });
  await saveOverlay(root, nextOverlay);
  return loadProfiles(root);
}

async function readRecentJsonLines(file, limit = 20) {
  if (!(await exists(file))) return [];
  const raw = await fs.readFile(file, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => JSON.parse(line));
}

async function getStatus(root = process.cwd()) {
  const { active } = await loadProfiles(root);
  const events = await readRecentJsonLines(statePath(root, EVENTS_LOG), 5);
  const patches = await readRecentJsonLines(statePath(root, PATCHES_LOG), 5);
  return {
    state_dir: statePath(root),
    profile: {
      id: active.id,
      version: active.version,
      growth: active.growth,
      rules: active.rules.length,
      lessons: active.memory.lessons.length
    },
    recent_events: events,
    recent_patches: patches
  };
}

module.exports = {
  STATE_DIR,
  statePath,
  initWorkspace,
  loadProfiles,
  saveOverlay,
  appendEvent,
  appendPatchAudit,
  applyPatchToOverlay,
  setGrowthLevel,
  getStatus
};

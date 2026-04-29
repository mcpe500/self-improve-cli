'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { deepMerge, validateProfile } = require('../profile');
const { applyJsonPatch } = require('../json-utils');
const {
  STATE_DIR, BASE_PROFILE, OVERLAY_PROFILE, MCP_CONFIG,
  statePath, exists, readJson, writeJson
} = require('./common');

function applyDefaults(value, defaults) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value) && defaults && typeof defaults === 'object' && !Array.isArray(defaults)) {
    const next = { ...value };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (next[key] === undefined) next[key] = defaultValue;
      else next[key] = applyDefaults(next[key], defaultValue);
    }
    return next;
  }
  return value === undefined ? defaults : value;
}

async function loadMcpConfig(root = process.cwd()) {
  return readJson(statePath(root, MCP_CONFIG), { mcpServers: {}, defaults: {} });
}

async function saveMcpConfig(root, config) {
  await writeJson(statePath(root, MCP_CONFIG), config);
}

async function getActiveSkills(root = process.cwd()) {
  const { overlay } = await loadProfiles(root);
  return overlay.memory?.active_skills || [];
}

async function setActiveSkills(root, names) {
  const { overlay } = await loadProfiles(root);
  if (!overlay.memory) overlay.memory = {};
  overlay.memory.active_skills = names;
  await saveOverlay(root, overlay);
  return names;
}

async function initWorkspace(root = process.cwd()) {
  const dir = statePath(root);
  await fs.mkdir(dir, { recursive: true });
  const defaultProfilePath = path.resolve(__dirname, '..', '..', 'profiles', 'default.profile.json');
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
  const { EVENTS_LOG, PATCHES_LOG, TRACES_LOG } = require('./common');
  for (const file of [EVENTS_LOG, PATCHES_LOG, TRACES_LOG]) {
    const target = statePath(root, file);
    if (!(await exists(target))) await fs.writeFile(target, '', 'utf8');
  }
  const mcpPath = statePath(root, MCP_CONFIG);
  if (!(await exists(mcpPath))) {
    await writeJson(mcpPath, { mcpServers: {}, defaults: {} });
  }
  return dir;
}

async function loadProfiles(root = process.cwd()) {
  await initWorkspace(root);
  const defaultProfilePath = path.resolve(__dirname, '..', '..', 'profiles', 'default.profile.json');
  const defaults = await readJson(defaultProfilePath);
  const baseRaw = await readJson(statePath(root, BASE_PROFILE));
  const overlay = await readJson(statePath(root, OVERLAY_PROFILE), {});
  const base = applyDefaults(baseRaw, defaults);
  validateProfile(base, 'base profile');
  const active = deepMerge(base, overlay);
  validateProfile(active, 'active profile');
  return { base, overlay, active };
}

async function saveOverlay(root, overlay) {
  const target = statePath(root, OVERLAY_PROFILE);
  if (await exists(target)) {
    const bak2 = target + '.bak.2';
    const bak1 = target + '.bak.1';
    const bak0 = target + '.bak.0';
    try { await fs.unlink(bak2); } catch {}
    try { await fs.rename(bak1, bak2); } catch {}
    try { await fs.rename(bak0, bak1); } catch {}
    try { await fs.copyFile(target, bak0); } catch {}
  }
  await writeJson(target, overlay);
}

async function applyPatchToOverlay(root, patch) {
  const { base, overlay } = await loadProfiles(root);
  const nextOverlay = applyJsonPatch(overlay, patch);
  const active = deepMerge(base, nextOverlay);
  validateProfile(active, 'active profile after patch');
  const tmpPath = statePath(root, OVERLAY_PROFILE + '.tmp');
  await writeJson(tmpPath, nextOverlay);
  await fs.rename(tmpPath, statePath(root, OVERLAY_PROFILE));
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

module.exports = {
  initWorkspace,
  loadProfiles,
  saveOverlay,
  applyPatchToOverlay,
  setGrowthLevel,
  loadMcpConfig,
  saveMcpConfig,
  getActiveSkills,
  setActiveSkills
};

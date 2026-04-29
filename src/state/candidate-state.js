'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
  STATE_DIR, OVERLAY_PROFILE, EVENTS_LOG, PATCHES_LOG, TRACES_LOG, OPTIMIZER_STATE,
  statePath, exists, readJson, writeJson
} = require('./common');
const { loadProfiles } = require('./profile-state');
const { countJsonLines, readRecentJsonLines } = require('./audit-log');

async function readOptimizerState(root = process.cwd()) {
  return readJson(statePath(root, OPTIMIZER_STATE), { last_trace_count: 0, last_run_at: null });
}

async function writeOptimizerState(root, state) {
  await writeJson(statePath(root, OPTIMIZER_STATE), state);
  return state;
}

async function getSelfImproveStatus(root = process.cwd()) {
  const { active, overlay } = await loadProfiles(root);
  const eventsCount = await countJsonLines(statePath(root, EVENTS_LOG));
  const patchesCount = await countJsonLines(statePath(root, PATCHES_LOG));
  const tracesCount = await countJsonLines(statePath(root, TRACES_LOG));
  const recentEvents = await readRecentJsonLines(statePath(root, EVENTS_LOG), 5);
  const recentPatches = await readRecentJsonLines(statePath(root, PATCHES_LOG), 5);
  const recentTraces = await readRecentJsonLines(statePath(root, TRACES_LOG), 5);
  const optimizer = await readOptimizerState(root);
  return {
    growth: active.growth,
    files: {
      overlay: statePath(root, OVERLAY_PROFILE),
      events: statePath(root, EVENTS_LOG),
      patches: statePath(root, PATCHES_LOG),
      traces: statePath(root, TRACES_LOG),
      optimizer: statePath(root, OPTIMIZER_STATE)
    },
    counts: {
      events: eventsCount,
      patches: patchesCount,
      traces: tracesCount,
      overlay_rules: Array.isArray(overlay.rules) ? overlay.rules.length : 0,
      overlay_lessons: Array.isArray(overlay.memory?.lessons) ? overlay.memory.lessons.length : 0
    },
    optimizer,
    recent_events: recentEvents,
    recent_patches: recentPatches,
    recent_traces: recentTraces,
    next: active.growth.auto_apply
      ? 'Auto-apply is enabled when growth gate allows patch.'
      : 'Use `self-improve learn <message> --apply` or enable `growth medium --auto-apply true`.'
  };
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

async function rollbackToBackup(root) {
  const bakPath = statePath(root, OVERLAY_PROFILE + '.bak.0');
  const curPath = statePath(root, OVERLAY_PROFILE);
  if (await exists(bakPath)) {
    await fs.copyFile(bakPath, curPath);
    return { reverted: true, source: 'backup.0' };
  }
  return { reverted: false, reason: 'no backup found' };
}

async function rollbackToBackupFromNumber(root, n = 0) {
  const bakPath = statePath(root, OVERLAY_PROFILE + '.bak.' + n);
  const curPath = statePath(root, OVERLAY_PROFILE);
  if (await exists(bakPath)) {
    await fs.copyFile(bakPath, curPath);
    return { reverted: true, source: 'backup.' + n };
  }
  return { reverted: false, reason: 'no backup found at .bak.' + n };
}

async function recordFailedPatch(root, patch, reason) {
  const optimizer = await readOptimizerState(root);
  const failed_patches = [...(optimizer.failed_patches || []), {
    patch,
    reason,
    failed_at: new Date().toISOString()
  }];
  await writeOptimizerState(root, { ...optimizer, failed_patches });
  return { recorded: true };
}

async function nextCandidateId(root) {
  const dir = path.join(root, STATE_DIR, 'candidates');
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir).catch(() => []);
  const nums = entries
    .filter(n => /^\d+$/.test(n))
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n));
  return nums.length === 0 ? 1 : Math.max(...nums) + 1;
}

async function writeCandidateHarness(root, id, harness) {
  const dir = path.join(root, STATE_DIR, 'candidates', String(id));
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, 'harness.json');
  await fs.writeFile(fp, JSON.stringify(harness, null, 2), 'utf8');
  return fp;
}

async function writeCandidateScores(root, id, scores) {
  const dir = path.join(root, STATE_DIR, 'candidates', String(id));
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, 'scores.json');
  await fs.writeFile(fp, JSON.stringify(scores, null, 2), 'utf8');
  return fp;
}

async function promoteCandidate(root, id) {
  const candDir = path.join(root, STATE_DIR, 'candidates', String(id));
  const harnessPath = path.join(candDir, 'harness.json');
  const overlayPath = path.join(root, STATE_DIR, 'overlay.profile.json');
  const harness = JSON.parse(await fs.readFile(harnessPath, 'utf8'));
  await fs.writeFile(overlayPath, JSON.stringify(harness, null, 2), 'utf8');
  return overlayPath;
}

async function loadCandidateScores(root, id) {
  const fp = path.join(root, STATE_DIR, 'candidates', String(id), 'scores.json');
  return JSON.parse(await fs.readFile(fp, 'utf8'));
}

async function listCandidates(root) {
  const dir = path.join(root, STATE_DIR, 'candidates');
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir).catch(() => []);
  return entries.filter(n => /^\d+$/.test(n)).map(n => parseInt(n, 10)).sort((a, b) => a - b);
}

module.exports = {
  readOptimizerState,
  writeOptimizerState,
  getSelfImproveStatus,
  getStatus,
  rollbackToBackup,
  rollbackToBackupFromNumber,
  recordFailedPatch,
  nextCandidateId,
  writeCandidateHarness,
  writeCandidateScores,
  promoteCandidate,
  loadCandidateScores,
  listCandidates
};

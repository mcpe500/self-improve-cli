'use strict';

/**
 * Snapshot System - Undo/Redo via git stash
 * 
 * Take snapshots before agent changes, allow undo/redo.
 */

const { spawn } = require('node:child_process');

/**
 * Run a git command.
 */
function git(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', () => resolve({ code: 1, stdout, stderr: 'git not found' }));
  });
}

/**
 * Check if we're in a git repo.
 */
async function isGitRepo(cwd) {
  const result = await git(['rev-parse', '--is-inside-work-tree'], cwd);
  return result.code === 0 && result.stdout.trim() === 'true';
}

/**
 * Check if working directory has uncommitted changes.
 */
async function isDirty(cwd) {
  const result = await git(['status', '--porcelain'], cwd);
  return result.stdout.trim().length > 0;
}

/**
 * Take a snapshot (push to stash stack with marker).
 */
async function takeSnapshot(cwd, label = 'sicli-snapshot') {
  if (!(await isGitRepo(cwd))) {
    return { ok: false, error: 'Not a git repo' };
  }
  if (!(await isDirty(cwd))) {
    return { ok: false, error: 'No changes to snapshot' };
  }

  const msg = `${label} ${new Date().toISOString()}`;
  const result = await git(['stash', 'push', '--include-untracked', '-m', msg], cwd);
  if (result.code !== 0) {
    return { ok: false, error: result.stderr.trim() || 'stash push failed' };
  }
  return { ok: true, message: msg };
}

/**
 * List sicli snapshots in stash stack.
 */
async function listSnapshots(cwd) {
  const result = await git(['stash', 'list'], cwd);
  if (result.code !== 0) return [];

  const lines = result.stdout.split('\n').filter(Boolean);
  return lines
    .filter((l) => l.includes('sicli-snapshot'))
    .map((l) => {
      const match = l.match(/^(stash@\{(\d+)\}):.*: (.*)$/);
      if (!match) return null;
      return { ref: match[1], index: parseInt(match[2], 10), message: match[3] };
    })
    .filter(Boolean);
}

/**
 * Undo: pop most recent snapshot.
 */
async function undo(cwd) {
  const snapshots = await listSnapshots(cwd);
  if (snapshots.length === 0) {
    return { ok: false, error: 'No snapshots to undo' };
  }

  const latest = snapshots[0];
  const result = await git(['stash', 'pop', latest.ref], cwd);
  if (result.code !== 0) {
    return { ok: false, error: result.stderr.trim() };
  }
  return { ok: true, message: `Reverted: ${latest.message}` };
}

module.exports = {
  isGitRepo,
  isDirty,
  takeSnapshot,
  listSnapshots,
  undo,
};

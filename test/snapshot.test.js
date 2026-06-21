'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const {
  isGitRepo,
  isDirty,
  takeSnapshot,
  listSnapshots,
  undo,
} = require('../src/snapshot');

async function makeRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-snap-'));
  spawnSync('git', ['init'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  await fs.writeFile(path.join(dir, 'initial.txt'), 'initial');
  spawnSync('git', ['add', '-A'], { cwd: dir });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: dir });
  return dir;
}

test('isGitRepo returns true in repo', async () => {
  const dir = await makeRepo();
  assert.equal(await isGitRepo(dir), true);
  await fs.rm(dir, { recursive: true });
});

test('isGitRepo returns false outside repo', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-snap-'));
  assert.equal(await isGitRepo(dir), false);
  await fs.rm(dir, { recursive: true });
});

test('isDirty returns false for clean repo', async () => {
  const dir = await makeRepo();
  assert.equal(await isDirty(dir), false);
  await fs.rm(dir, { recursive: true });
});

test('isDirty returns true for repo with changes', async () => {
  const dir = await makeRepo();
  await fs.writeFile(path.join(dir, 'new.txt'), 'new');
  assert.equal(await isDirty(dir), true);
  await fs.rm(dir, { recursive: true });
});

test('takeSnapshot fails on clean repo', async () => {
  const dir = await makeRepo();
  const result = await takeSnapshot(dir);
  assert.equal(result.ok, false);
  await fs.rm(dir, { recursive: true });
});

test('takeSnapshot succeeds on dirty repo', async () => {
  const dir = await makeRepo();
  await fs.writeFile(path.join(dir, 'change.txt'), 'change');
  const result = await takeSnapshot(dir);
  assert.equal(result.ok, true);
  // After snapshot, working dir should be clean
  assert.equal(await isDirty(dir), false);
  await fs.rm(dir, { recursive: true });
});

test('listSnapshots returns sicli snapshots', async () => {
  const dir = await makeRepo();
  await fs.writeFile(path.join(dir, 'a.txt'), 'a');
  await takeSnapshot(dir);
  
  const snaps = await listSnapshots(dir);
  assert.equal(snaps.length, 1);
  assert.ok(snaps[0].message.includes('sicli-snapshot'));
  
  await fs.rm(dir, { recursive: true });
});

test('listSnapshots filters out non-sicli stashes', async () => {
  const dir = await makeRepo();
  await fs.writeFile(path.join(dir, 'a.txt'), 'a');
  spawnSync('git', ['stash', 'push', '-m', 'manual-stash'], { cwd: dir });
  
  await fs.writeFile(path.join(dir, 'b.txt'), 'b');
  await takeSnapshot(dir);
  
  const snaps = await listSnapshots(dir);
  assert.equal(snaps.length, 1); // Only sicli snapshot
  
  await fs.rm(dir, { recursive: true });
});

test('undo reverts most recent snapshot', async () => {
  const dir = await makeRepo();
  await fs.writeFile(path.join(dir, 'change.txt'), 'change');
  await takeSnapshot(dir);
  
  // Verify file is gone after snapshot
  assert.equal(await isDirty(dir), false);
  
  // Undo should bring it back
  const result = await undo(dir);
  assert.equal(result.ok, true);
  assert.equal(await isDirty(dir), true);
  
  await fs.rm(dir, { recursive: true });
});

test('undo fails with no snapshots', async () => {
  const dir = await makeRepo();
  const result = await undo(dir);
  assert.equal(result.ok, false);
  await fs.rm(dir, { recursive: true });
});

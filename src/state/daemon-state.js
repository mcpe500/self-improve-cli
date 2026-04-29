'use strict';

const fs = require('node:fs/promises');
const {
  DAEMON_STATE, DAEMON_PID,
  statePath, readJson, writeJson
} = require('./common');

async function readDaemonState(root) {
  const fp = statePath(root, DAEMON_STATE);
  return readJson(fp, null);
}

async function writeDaemonState(root, state) {
  const fp = statePath(root, DAEMON_STATE);
  await writeJson(fp, state);
}

async function writeDaemonPid(root, pid) {
  const fp = statePath(root, DAEMON_PID);
  await fs.writeFile(fp, String(pid), 'utf8');
}

async function readDaemonPid(root) {
  const fp = statePath(root, DAEMON_PID);
  try {
    const content = await fs.readFile(fp, 'utf8');
    return parseInt(content.trim(), 10);
  } catch {
    return null;
  }
}

async function clearDaemonPid(root) {
  const fp = statePath(root, DAEMON_PID);
  try {
    await fs.unlink(fp);
  } catch {}
}

async function isDaemonRunning(root) {
  const pid = await readDaemonPid(root);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  readDaemonState,
  writeDaemonState,
  writeDaemonPid,
  readDaemonPid,
  clearDaemonPid,
  isDaemonRunning
};

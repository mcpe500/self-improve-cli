'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

/**
 * Cross-platform config directory resolution.
 * Follows XDG Base Directory spec on Linux, standard paths on macOS/Windows.
 */

function getGlobalConfigDir() {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'win32') {
    // Windows: %APPDATA%/self-improve-cli
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'self-improve-cli');
  }

  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/self-improve-cli
    return path.join(home, 'Library', 'Application Support', 'self-improve-cli');
  }

  // Linux/Unix: ${XDG_CONFIG_HOME:-~/.config}/self-improve-cli
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(xdgConfig, 'self-improve-cli');
}

function getLocalConfigDir(root) {
  return path.join(root, '.selfimprove');
}

function getGlobalConfigPath() {
  return path.join(getGlobalConfigDir(), 'config.json');
}

function getLocalConfigPath(root) {
  return path.join(getLocalConfigDir(root), 'config.json');
}

async function ensureGlobalConfigDir() {
  const dir = getGlobalConfigDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function ensureLocalConfigDir(root) {
  const dir = getLocalConfigDir(root);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

module.exports = {
  getGlobalConfigDir,
  getLocalConfigDir,
  getGlobalConfigPath,
  getLocalConfigPath,
  ensureGlobalConfigDir,
  ensureLocalConfigDir,
};

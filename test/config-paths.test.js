'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { getGlobalConfigDir, getLocalConfigDir, getGlobalConfigPath, getLocalConfigPath } = require('../src/config-paths');

test('getGlobalConfigDir returns platform-specific path', () => {
  const dir = getGlobalConfigDir();
  assert.ok(dir.includes('self-improve-cli'));
  
  const platform = os.platform();
  if (platform === 'win32') {
    assert.ok(dir.includes('AppData') || dir.includes('Roaming'));
  } else if (platform === 'darwin') {
    assert.ok(dir.includes('Library'));
    assert.ok(dir.includes('Application Support'));
  } else {
    // Linux/Unix
    assert.ok(dir.includes('.config') || dir.includes('XDG'));
  }
});

test('getLocalConfigDir returns .selfimprove in workspace', () => {
  const root = '/test/workspace';
  const dir = getLocalConfigDir(root);
  assert.equal(dir, path.join(root, '.selfimprove'));
});

test('getGlobalConfigPath returns config.json in global dir', () => {
  const configPath = getGlobalConfigPath();
  assert.ok(configPath.endsWith('config.json'));
  assert.ok(configPath.includes('self-improve-cli'));
});

test('getLocalConfigPath returns config.json in workspace', () => {
  const root = '/test/workspace';
  const configPath = getLocalConfigPath(root);
  assert.equal(configPath, path.join(root, '.selfimprove', 'config.json'));
});

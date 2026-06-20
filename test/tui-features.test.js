'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TUI } = require('../src/tui');

test('TUI class can be instantiated', () => {
  const tui = new TUI('/tmp/test');
  assert.equal(typeof tui, 'object');
  assert.equal(tui.root, '/tmp/test');
  assert.equal(tui.currentView, 'chat');
  assert.ok(Array.isArray(tui.chatHistory));
});

test('TUI has tab completion method', () => {
  const tui = new TUI('/tmp/test');
  assert.equal(typeof tui.getTabCompletion, 'function');
});

test('TUI tab completion returns full command on single match', () => {
  const tui = new TUI('/tmp/test');
  const completion = tui.getTabCompletion('/hel');
  assert.equal(completion, '/help ');
});

test('TUI tab completion returns null on no match', () => {
  const tui = new TUI('/tmp/test');
  const completion = tui.getTabCompletion('/xyz');
  assert.equal(completion, null);
});

test('TUI tab completion returns null for multiple matches', async (t) => {
  const tui = new TUI('/tmp/test');
  // Mock showMessage to avoid screen access
  tui.showMessage = () => {};
  // /swarm and /self-improve both start with /s
  const completion = tui.getTabCompletion('/s');
  assert.equal(completion, null);
});

test('TUI has theme support methods', () => {
  const tui = new TUI('/tmp/test');
  assert.equal(typeof tui.getThemes, 'function');
  assert.equal(typeof tui.applyTheme, 'function');
});

test('TUI getThemes returns object with theme definitions', () => {
  const tui = new TUI('/tmp/test');
  const themes = tui.getThemes();
  assert.equal(typeof themes, 'object');
  assert.ok(themes.default);
  assert.ok(themes.dark);
  assert.ok(themes.light);
  assert.ok(themes.ocean);
  assert.ok(themes.matrix);
});

test('TUI has export/import methods', () => {
  const tui = new TUI('/tmp/test');
  assert.equal(typeof tui.exportConfig, 'function');
  assert.equal(typeof tui.importConfig, 'function');
});

test('TUI has MCP add/remove methods', () => {
  const tui = new TUI('/tmp/test');
  assert.equal(typeof tui.addMCPServer, 'function');
  assert.equal(typeof tui.removeMCPServer, 'function');
});

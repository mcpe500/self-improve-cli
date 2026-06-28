'use strict';

/**
 * TDD tests for Phase 1 P0 features:
 * F1: Tab = mode toggle
 * F2: Command Palette (/ hotkey)
 * F3: Ctrl+P Provider/Model Picker
 * F4: startSpinner / stopSpinner
 * F5: handleShellCommand with streaming output
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { TUI } = require('../src/tui');

function createTUI(configOverrides = {}) {
  const tui = new TUI('/tmp/test-p0');
  tui.config = {
    active_provider: 'openai',
    active_model: 'gpt-4.1-mini',
    permission_mode: 'partial_secure',
    providers: {},
    ...configOverrides,
  };
  tui.uiMode = 'input';
  tui.chatHistory = [];
  tui.commandHistory = [];
  tui.historyIndex = -1;
  tui.currentMode = 'build';
  tui.processing = false;
  tui.gitBranch = 'main';
  tui._spinnerInterval = null;
  tui.log = function (msg, type) { this.chatHistory.push({ msg, type }); };
  tui.updateHeader = function () { this._headerUpdated = true; };
  tui.updateSidebar = function () { this._sidebarUpdated = true; };
  tui.updateFooter = function () { this._footerUpdated = true; };
  tui.screen = { render: () => {} };
  tui.footer = { setContent: (c) => { tui._footerContent = c; } };
  tui.statusBar = tui.footer;
  tui.inputBox = {
    getValue: () => tui._inputValue || '',
    setValue: (v) => { tui._inputValue = v; },
    clearValue: () => { tui._inputValue = ''; },
    focus: () => {},
  };
  return tui;
}

// ── F1: Tab = Mode Toggle ────────────────────────────────────────────

test('toggleMode switches from build to plan', () => {
  const tui = createTUI();
  tui.currentMode = 'build';
  tui.toggleMode();
  assert.equal(tui.currentMode, 'plan');
});

test('toggleMode switches from plan to build', () => {
  const tui = createTUI();
  tui.currentMode = 'plan';
  tui.toggleMode();
  assert.equal(tui.currentMode, 'build');
});

test('toggleMode logs mode change message', () => {
  const tui = createTUI();
  tui.currentMode = 'build';
  tui.toggleMode();
  const last = tui.chatHistory[tui.chatHistory.length - 1];
  assert.ok(last, 'should log something');
  assert.ok(last.msg.toLowerCase().includes('plan') || last.msg.toLowerCase().includes('mode'),
    'log should mention plan or mode');
});

test('toggleMode calls updateHeader', () => {
  const tui = createTUI();
  tui.currentMode = 'build';
  tui.toggleMode();
  assert.ok(tui._headerUpdated, 'updateHeader should be called after toggle');
});

// ── F2: Command Palette ──────────────────────────────────────────────

test('TUI has showCommandPalette method', () => {
  const tui = new TUI('/tmp/test-p0');
  assert.equal(typeof tui.showCommandPalette, 'function');
});

test('PALETTE_COMMANDS exported or accessible on TUI instance', () => {
  const tui = new TUI('/tmp/test-p0');
  // Either exposed as static property or accessible via method
  const hasPalette = typeof tui.PALETTE_COMMANDS !== 'undefined' ||
                     typeof TUI.PALETTE_COMMANDS !== 'undefined' ||
                     typeof tui.getPaletteCommands === 'function';
  assert.ok(hasPalette, 'PALETTE_COMMANDS or getPaletteCommands should be accessible');
});

test('palette commands list has at least 20 entries', () => {
  const tui = new TUI('/tmp/test-p0');
  const cmds = tui.PALETTE_COMMANDS || TUI.PALETTE_COMMANDS ||
               (typeof tui.getPaletteCommands === 'function' ? tui.getPaletteCommands() : null);
  assert.ok(cmds, 'palette commands should exist');
  assert.ok(cmds.length >= 20, `expected >= 20, got ${cmds.length}`);
});

test('palette commands each have cmd and desc fields', () => {
  const tui = new TUI('/tmp/test-p0');
  const cmds = tui.PALETTE_COMMANDS || TUI.PALETTE_COMMANDS ||
               (typeof tui.getPaletteCommands === 'function' ? tui.getPaletteCommands() : null);
  for (const entry of cmds) {
    assert.ok(typeof entry.cmd === 'string' && entry.cmd.startsWith('/'),
      `cmd should be string starting with /: ${JSON.stringify(entry)}`);
    assert.ok(typeof entry.desc === 'string' && entry.desc.length > 0,
      `desc should be non-empty string: ${JSON.stringify(entry)}`);
  }
});

test('palette filter reduces items by substring match', () => {
  const tui = new TUI('/tmp/test-p0');
  const cmds = tui.PALETTE_COMMANDS || TUI.PALETTE_COMMANDS ||
               (typeof tui.getPaletteCommands === 'function' ? tui.getPaletteCommands() : null);
  const filtered = cmds.filter(c =>
    c.cmd.includes('provider') || c.desc.toLowerCase().includes('provider')
  );
  assert.ok(filtered.length >= 1, 'filtering by "provider" should return at least one result');
  assert.ok(filtered.length < cmds.length, 'filtered list should be shorter than full list');
});

test('showCommandPalette sets uiMode to modal', () => {
  const tui = createTUI();
  tui.screen = { append: () => {}, render: () => {}, key: () => {} };
  try {
    tui.showCommandPalette();
    assert.equal(tui.uiMode, 'modal', 'uiMode should be modal when palette opens');
  } catch (e) {
    // Blessed widgets need a real terminal — without one, widget creation throws.
    // The key assertion is that uiMode flips to 'modal' before the throw.
    assert.equal(tui.uiMode, 'modal', 'uiMode should be set to modal before any blessed error');
  }
});

// ── F3: Ctrl+P Provider/Model Picker ────────────────────────────────

test('TUI has showProviderModelPicker method', () => {
  const tui = new TUI('/tmp/test-p0');
  assert.equal(typeof tui.showProviderModelPicker, 'function');
});

test('showProviderModelPicker calls showList with providers', () => {
  const tui = createTUI();
  const listCalls = [];
  tui.showList = (label, items, cb) => { listCalls.push({ label, items, cb }); };

  tui.showProviderModelPicker();

  assert.ok(listCalls.length >= 1, 'showList should be called');
  const providerCall = listCalls[0];
  assert.ok(
    providerCall.label.toLowerCase().includes('provider'),
    `first showList call label should include 'provider', got: ${providerCall.label}`
  );
  assert.ok(providerCall.items.length >= 7, 'should list at least 7 providers + Cancel');
});

test('showProviderModelPicker includes Cancel item', () => {
  const tui = createTUI();
  const listCalls = [];
  tui.showList = (label, items, cb) => { listCalls.push({ label, items, cb }); };

  tui.showProviderModelPicker();
  const items = listCalls[0].items;
  assert.ok(items[items.length - 1] === 'Cancel', 'last item should be Cancel');
});

test('showProviderModelPicker Cancel does not change provider', () => {
  const tui = createTUI({ active_provider: 'openai' });
  let listCallback;
  tui.showList = (_label, items, cb) => { listCallback = cb; };

  tui.showProviderModelPicker();
  // Simulate selecting Cancel (last index)
  const callItems = [];
  tui.showList = (_l, items, _cb) => { callItems.push(...items); };
  // Call with cancel index
  listCallback(999); // out-of-range = cancel path

  assert.equal(tui.config.active_provider, 'openai', 'provider should not change on Cancel');
});

// ── F4: Spinner ──────────────────────────────────────────────────────

test('TUI has startSpinner method', () => {
  const tui = new TUI('/tmp/test-p0');
  assert.equal(typeof tui.startSpinner, 'function');
});

test('TUI has stopSpinner method', () => {
  const tui = new TUI('/tmp/test-p0');
  assert.equal(typeof tui.stopSpinner, 'function');
});

test('startSpinner sets _spinnerInterval', () => {
  const tui = createTUI();
  assert.equal(tui._spinnerInterval, null);
  tui.startSpinner('Testing');
  assert.notEqual(tui._spinnerInterval, null, '_spinnerInterval should be set after startSpinner');
  clearInterval(tui._spinnerInterval);
  tui._spinnerInterval = null;
});

test('stopSpinner clears _spinnerInterval', () => {
  const tui = createTUI();
  tui.startSpinner('Testing');
  assert.notEqual(tui._spinnerInterval, null);
  tui.stopSpinner();
  assert.equal(tui._spinnerInterval, null, '_spinnerInterval should be null after stopSpinner');
});

test('stopSpinner calls updateFooter', () => {
  const tui = createTUI();
  tui.startSpinner('Testing');
  tui.stopSpinner();
  assert.ok(tui._footerUpdated, 'updateFooter should be called by stopSpinner');
});

test('stopSpinner is safe to call when no spinner is running', () => {
  const tui = createTUI();
  assert.doesNotThrow(() => tui.stopSpinner(), 'stopSpinner should not throw when idle');
});

test('startSpinner updates footer content with spinner frame', (t, done) => {
  const tui = createTUI();
  tui.startSpinner('Working');
  setTimeout(() => {
    clearInterval(tui._spinnerInterval);
    tui._spinnerInterval = null;
    assert.ok(typeof tui._footerContent === 'string', 'footer content should be set');
    assert.ok(tui._footerContent.includes('Working'), 'footer content should include spinner message');
    done();
  }, 200);
});

// ── F5: Streaming shell ──────────────────────────────────────────────

test('TUI has handleShellCommand method', () => {
  const tui = new TUI('/tmp/test-p0');
  assert.equal(typeof tui.handleShellCommand, 'function');
});

test('handleShellCommand calls startSpinner', async () => {
  const tui = createTUI();
  const spinnerCalls = [];
  tui.startSpinner = (msg) => { spinnerCalls.push(msg); tui._spinnerInterval = 1; };
  tui.stopSpinner = () => { tui._spinnerInterval = null; tui._footerUpdated = true; };

  await tui.handleShellCommand('echo hello');
  assert.ok(spinnerCalls.length > 0, 'startSpinner should be called');
});

test('handleShellCommand calls stopSpinner after completion', async () => {
  const tui = createTUI();
  let stopped = false;
  tui.startSpinner = () => { tui._spinnerInterval = 1; };
  tui.stopSpinner = () => { stopped = true; tui._spinnerInterval = null; tui._footerUpdated = true; };

  await tui.handleShellCommand('echo hello');
  assert.ok(stopped, 'stopSpinner should be called after command completes');
});

test('handleShellCommand logs command output to chat', async () => {
  const tui = createTUI();
  tui.startSpinner = () => { tui._spinnerInterval = 1; };
  tui.stopSpinner = () => { tui._spinnerInterval = null; tui._footerUpdated = true; };

  await tui.handleShellCommand('echo hello-world-test');
  const msgs = tui.chatHistory.map(e => e.msg).join(' ');
  assert.ok(msgs.includes('hello-world-test'), 'output of echo should appear in chat history');
});

test('handleShellCommand logs error for empty command', async () => {
  const tui = createTUI();
  tui.startSpinner = () => {};
  tui.stopSpinner = () => { tui._footerUpdated = true; };

  await tui.handleShellCommand('');
  const last = tui.chatHistory[tui.chatHistory.length - 1];
  assert.equal(last.type, 'error', 'empty command should log an error');
});

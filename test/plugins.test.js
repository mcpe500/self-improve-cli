'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { on, emit, clear, listEvents, handlerCount, loadFromConfig, VALID_EVENTS } = require('../src/plugins');

test('VALID_EVENTS includes core lifecycle events', () => {
  assert.ok(VALID_EVENTS.includes('before_tool'));
  assert.ok(VALID_EVENTS.includes('after_tool'));
  assert.ok(VALID_EVENTS.includes('on_session_start'));
});

test('on() registers handler', () => {
  clear();
  on('before_tool', () => 'ok');
  assert.equal(handlerCount('before_tool'), 1);
});

test('on() throws for unknown event', () => {
  clear();
  assert.throws(() => on('unknown_event', () => {}), /Unknown event/);
});

test('on() throws for non-function handler', () => {
  clear();
  assert.throws(() => on('before_tool', 'not a function'), /Handler must be a function/);
});

test('emit() calls handlers', async () => {
  clear();
  let called = false;
  on('before_tool', () => { called = true; });
  await emit('before_tool', {});
  assert.equal(called, true);
});

test('emit() collects return values', async () => {
  clear();
  on('after_tool', () => 'result1');
  on('after_tool', () => 'result2');
  const results = await emit('after_tool', {});
  assert.deepEqual(results, ['result1', 'result2']);
});

test('emit() swallows handler errors', async () => {
  clear();
  on('before_tool', () => { throw new Error('boom'); });
  on('before_tool', () => 'still works');
  const results = await emit('before_tool', {});
  assert.deepEqual(results, ['still works']);
});

test('emit() returns empty for unknown event', async () => {
  clear();
  const results = await emit('unknown_event');
  assert.deepEqual(results, []);
});

test('emit() passes payload to handlers', async () => {
  clear();
  let received;
  on('before_tool', (payload) => { received = payload; });
  await emit('before_tool', { tool: 'read', file: 'test.js' });
  assert.equal(received.tool, 'read');
  assert.equal(received.file, 'test.js');
});

test('emit() supports async handlers', async () => {
  clear();
  on('after_tool', async () => {
    return new Promise((resolve) => setTimeout(() => resolve('async'), 10));
  });
  const results = await emit('after_tool', {});
  assert.deepEqual(results, ['async']);
});

test('clear() removes all handlers', () => {
  clear();
  on('before_tool', () => {});
  on('after_tool', () => {});
  clear();
  assert.equal(handlerCount('before_tool'), 0);
  assert.equal(handlerCount('after_tool'), 0);
});

test('listEvents() returns events with handlers', () => {
  clear();
  on('before_tool', () => {});
  on('on_session_start', () => {});
  const events = listEvents();
  assert.ok(events.includes('before_tool'));
  assert.ok(events.includes('on_session_start'));
});

test('handlerCount() returns 0 for empty event', () => {
  clear();
  assert.equal(handlerCount('before_tool'), 0);
});

test('loadFromConfig() registers command-string hooks', () => {
  clear();
  const count = loadFromConfig({
    hooks: {
      before_tool: ['echo hello'],
    },
  });
  assert.equal(count, 1);
  assert.equal(handlerCount('before_tool'), 1);
});

test('loadFromConfig() skips invalid events', () => {
  clear();
  const count = loadFromConfig({
    hooks: {
      invalid_event: ['echo hello'],
    },
  });
  assert.equal(count, 0);
});

test('loadFromConfig() handles empty config', () => {
  clear();
  assert.equal(loadFromConfig({}), 0);
  assert.equal(loadFromConfig(), 0);
});

test('loadFromConfig() registers function handlers', () => {
  clear();
  const fn = () => 'custom';
  const count = loadFromConfig({
    hooks: {
      after_tool: [fn],
    },
  });
  assert.equal(count, 1);
});

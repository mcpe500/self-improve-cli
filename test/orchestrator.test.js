'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeResults } = require('../src/orchestrator');

test('mergeResults aggregates settled feature results', () => {
  const results = [
    { status: 'fulfilled', value: { feature: { id: 'a' }, status: 'completed' } },
    { status: 'fulfilled', value: { feature: { id: 'b' }, status: 'completed_with_warnings' } },
    { status: 'rejected', reason: new Error('worker crashed') },
    { status: 'fulfilled', value: { feature: { id: 'c' }, status: 'failed', error: 'timeout' } }
  ];
  const merged = mergeResults(results);
  assert.equal(merged.ok, false);
  assert.equal(merged.successful.length, 1);
  assert.equal(merged.warnings.length, 1);
  assert.equal(merged.failed.length, 2);
  assert.match(merged.summary, /1 succeeded/);
  assert.match(merged.summary, /1 with warnings/);
  assert.match(merged.summary, /2 failed/);
});

test('mergeResults reports ok when all succeed', () => {
  const results = [
    { status: 'fulfilled', value: { feature: { id: 'a' }, status: 'completed' } }
  ];
  const merged = mergeResults(results);
  assert.equal(merged.ok, true);
  assert.equal(merged.successful.length, 1);
  assert.equal(merged.failed.length, 0);
});

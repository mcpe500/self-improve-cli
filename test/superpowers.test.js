'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDefaultSuperpowers, validateSuperpowers, applyPreset, isEnabled, listSuperpowers, listPresets } = require('../src/superpowers');

test('getDefaultSuperpowers returns object with boolean values', () => {
  const powers = getDefaultSuperpowers();
  assert.equal(typeof powers, 'object');
  assert.equal(typeof powers.chat, 'boolean');
  assert.equal(typeof powers.tools, 'boolean');
  assert.equal(powers.chat, true);
  assert.equal(powers.autonomous, false);
});

test('validateSuperpowers accepts valid powers', () => {
  const result = validateSuperpowers({ chat: true, tools: false });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateSuperpowers rejects unknown powers', () => {
  const result = validateSuperpowers({ unknown_power: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('unknown_power')));
});

test('validateSuperpowers rejects non-boolean values', () => {
  const result = validateSuperpowers({ chat: 'yes' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('boolean')));
});

test('applyPreset returns valid powers object', () => {
  const safe = applyPreset('safe');
  assert.equal(typeof safe, 'object');
  assert.equal(safe.chat, true);
  assert.equal(safe.autonomous, false);
  assert.equal(safe.tools, false);
});

test('applyPreset throws for unknown preset', () => {
  assert.throws(() => applyPreset('unknown'), /Unknown preset/);
});

test('isEnabled checks config and returns defaults', () => {
  const config = { superpowers: { chat: false } };
  assert.equal(isEnabled(config, 'chat'), false);
  assert.equal(isEnabled(config, 'tools'), true); // default
  assert.equal(isEnabled({}, 'chat'), true); // no config, use default
});

test('listSuperpowers returns array of power definitions', () => {
  const powers = listSuperpowers();
  assert.ok(Array.isArray(powers));
  assert.ok(powers.length >= 8);
  assert.ok(powers.some(p => p.name === 'chat'));
  assert.ok(powers.some(p => p.name === 'autonomous'));
});

test('listPresets returns array of preset definitions', () => {
  const presets = listPresets();
  assert.ok(Array.isArray(presets));
  assert.equal(presets.length, 3);
  assert.ok(presets.some(p => p.name === 'safe'));
  assert.ok(presets.some(p => p.name === 'balanced'));
  assert.ok(presets.some(p => p.name === 'power'));
});

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { stripThinkBlocks, stripJsonCodeBlock, compactJson } = require('../src/text-utils');

describe('stripThinkBlocks', () => {
  it('removes think tags', () => {
    assert.equal(stripThinkBlocks('<think>hidden</think>\nHello!'), 'Hello!');
  });

  it('returns empty string for null', () => {
    assert.equal(stripThinkBlocks(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(stripThinkBlocks(undefined), '');
  });

  it('handles multiple think blocks', () => {
    assert.equal(stripThinkBlocks('<think>a</think>text<think>b</think>'), 'text');
  });
});

describe('stripJsonCodeBlock', () => {
  it('removes json code fence', () => {
    assert.equal(stripJsonCodeBlock('```json\n{"a":1}\n```'), '{"a":1}');
  });

  it('handles no fence', () => {
    assert.equal(stripJsonCodeBlock('{"a":1}'), '{"a":1}');
  });
});

describe('compactJson', () => {
  it('returns full json when under limit', () => {
    assert.equal(compactJson({ a: 1 }), '{"a":1}');
  });

  it('truncates when over limit', () => {
    const big = { a: 'x'.repeat(100) };
    const result = compactJson(big, 10);
    assert.ok(result.includes('...<truncated>'));
  });
});

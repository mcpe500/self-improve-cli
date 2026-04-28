'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { appendJsonLine, readAllJsonLines, readRecentJsonLines, applyJsonPatch } = require('../src/json-utils');

describe('appendJsonLine + readAllJsonLines', () => {
  it('round-trips json lines', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-json-'));
    const file = path.join(tmpDir, 'test.jsonl');
    await appendJsonLine(file, { a: 1 });
    await appendJsonLine(file, { b: 2 });
    const lines = await readAllJsonLines(file);
    assert.deepStrictEqual(lines, [{ a: 1 }, { b: 2 }]);
    await fs.rm(tmpDir, { recursive: true });
  });

  it('returns empty array for missing file', async () => {
    const lines = await readAllJsonLines('/nonexistent/file.jsonl');
    assert.deepStrictEqual(lines, []);
  });

  it('readRecentJsonLines respects limit', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-json-'));
    const file = path.join(tmpDir, 'test.jsonl');
    for (let i = 0; i < 5; i++) await appendJsonLine(file, { n: i });
    const lines = await readRecentJsonLines(file, { limit: 2 });
    assert.deepStrictEqual(lines, [{ n: 3 }, { n: 4 }]);
    await fs.rm(tmpDir, { recursive: true });
  });
});

describe('applyJsonPatch', () => {
  it('supports add replace remove', () => {
    const doc = { rules: ['a'], growth: { max_patch_ops: 3 } };
    const next = applyJsonPatch(doc, [
      { op: 'add', path: '/rules/-', value: 'b' },
      { op: 'replace', path: '/growth/max_patch_ops', value: 4 },
      { op: 'remove', path: '/rules/0' }
    ]);
    assert.deepStrictEqual(next, { rules: ['b'], growth: { max_patch_ops: 4 } });
  });

  it('creates missing array parents for add', () => {
    const next = applyJsonPatch({}, [
      { op: 'add', path: '/memory/lessons/-', value: 'learned' }
    ]);
    assert.deepStrictEqual(next, { memory: { lessons: ['learned'] } });
  });

  it('throws on unsupported op', () => {
    assert.throws(() => applyJsonPatch({}, [{ op: 'move', path: '/a' }]), /Unsupported patch op/);
  });

  it('throws on missing path for replace', () => {
    assert.throws(() => applyJsonPatch({}, [{ op: 'replace', path: '/a', value: 1 }]), /Missing path/);
  });
});

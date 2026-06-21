'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  parseFileReferences,
  readFileLimited,
  attachFileContent,
  formatAttachmentSummary,
} = require('../src/file-reference');

test('parseFileReferences extracts @file paths', () => {
  const text = 'Fix @src/auth.js and @src/utils.js';
  const files = parseFileReferences(text);
  assert.deepEqual(files, ['src/auth.js', 'src/utils.js']);
});

test('parseFileReferences handles single file', () => {
  const text = 'Review @README.md';
  const files = parseFileReferences(text);
  assert.deepEqual(files, ['README.md']);
});

test('parseFileReferences handles paths with directories', () => {
  const text = 'Check @src/components/Button.tsx';
  const files = parseFileReferences(text);
  assert.deepEqual(files, ['src/components/Button.tsx']);
});

test('parseFileReferences dedupes', () => {
  const text = 'Fix @src/auth.js and @src/auth.js again';
  const files = parseFileReferences(text);
  assert.deepEqual(files, ['src/auth.js']);
});

test('parseFileReferences returns empty for no refs', () => {
  const text = 'Just a regular message';
  const files = parseFileReferences(text);
  assert.deepEqual(files, []);
});

test('readFileLimited returns content for existing file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  await fs.writeFile(path.join(tmpDir, 'test.txt'), 'hello world');
  
  const content = await readFileLimited(tmpDir, 'test.txt');
  assert.equal(content, 'hello world');
  
  await fs.rm(tmpDir, { recursive: true });
});

test('readFileLimited returns null for missing file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const content = await readFileLimited(tmpDir, 'missing.txt');
  assert.equal(content, null);
  await fs.rm(tmpDir, { recursive: true });
});

test('readFileLimited truncates large files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const large = 'x'.repeat(200);
  await fs.writeFile(path.join(tmpDir, 'large.txt'), large);
  
  const content = await readFileLimited(tmpDir, 'large.txt', 100);
  assert.ok(content.includes('truncated'));
  assert.ok(content.length < 200);
  
  await fs.rm(tmpDir, { recursive: true });
});

test('attachFileContent attaches files and cleans prompt', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  await fs.writeFile(path.join(tmpDir, 'auth.js'), 'console.log("auth");');
  
  const result = await attachFileContent(tmpDir, '@auth.js fix the bug');
  assert.deepEqual(result.attached, ['auth.js']);
  assert.deepEqual(result.missing, []);
  assert.ok(result.prompt.includes('[File: auth.js]'));
  assert.ok(result.prompt.includes('console.log'));
  assert.ok(result.prompt.includes('fix the bug'));
  assert.ok(!result.prompt.includes('@auth.js'));
  
  await fs.rm(tmpDir, { recursive: true });
});

test('attachFileContent reports missing files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const result = await attachFileContent(tmpDir, '@missing.js help');
  assert.deepEqual(result.attached, []);
  assert.deepEqual(result.missing, ['missing.js']);
  assert.equal(result.prompt, 'help');
  
  await fs.rm(tmpDir, { recursive: true });
});

test('formatAttachmentSummary shows attached and missing', () => {
  const summary = formatAttachmentSummary({
    attached: ['a.js', 'b.js'],
    missing: ['c.js'],
  });
  assert.ok(summary.includes('Attached 2 file(s)'));
  assert.ok(summary.includes('a.js'));
  assert.ok(summary.includes('Missing 1 file(s)'));
});

test('formatAttachmentSummary returns empty for nothing', () => {
  const summary = formatAttachmentSummary({ attached: [], missing: [] });
  assert.equal(summary, '');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseErrors,
  formatDiagnostics,
  getDiagnosticSummary,
} = require('../src/diagnostics');

test('parseErrors parses TypeScript errors', () => {
  const output = `src/app.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.`;
  const diagnostics = parseErrors(output);
  
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].file, 'src/app.ts');
  assert.equal(diagnostics[0].line, 10);
  assert.equal(diagnostics[0].column, 5);
  assert.ok(diagnostics[0].message.includes('not assignable'));
});

test('parseErrors parses ESLint errors', () => {
  const output = `  src/utils.js:25:10  error  'foo' is not defined  no-undef`;
  const diagnostics = parseErrors(output);
  
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].file, 'src/utils.js');
  assert.equal(diagnostics[0].line, 25);
  assert.equal(diagnostics[0].column, 10);
});

test('parseErrors parses generic file:line:col errors', () => {
  const output = `test/app.test.js:42:15: Expected 1 argument but got 2`;
  const diagnostics = parseErrors(output);
  
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].file, 'test/app.test.js');
  assert.equal(diagnostics[0].line, 42);
  assert.equal(diagnostics[0].column, 15);
});

test('parseErrors parses generic file:line errors', () => {
  const output = `src/index.js:100: Unexpected token`;
  const diagnostics = parseErrors(output);
  
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].file, 'src/index.js');
  assert.equal(diagnostics[0].line, 100);
});

test('parseErrors handles multiple errors', () => {
  const output = `
src/a.js:10:5 - error TS2322: Type error
src/b.js:20:10 - error TS2304: Cannot find name
src/a.js:10:5 - error TS2322: Type error
`;
  const diagnostics = parseErrors(output);
  
  // Should deduplicate
  assert.equal(diagnostics.length, 2);
});

test('parseErrors returns empty for no errors', () => {
  const output = `All tests passed!\n✓ 42 tests completed`;
  const diagnostics = parseErrors(output);
  assert.deepEqual(diagnostics, []);
});

test('formatDiagnostics formats empty list', () => {
  const result = formatDiagnostics([]);
  assert.ok(result.includes('No errors'));
});

test('formatDiagnostics formats diagnostics', () => {
  const diagnostics = [
    { file: 'a.js', line: 10, column: 5, message: 'Error 1' },
    { file: 'b.js', line: 20, column: 10, message: 'Error 2' },
  ];
  
  const result = formatDiagnostics(diagnostics);
  assert.ok(result.includes('Found 2 error(s)'));
  assert.ok(result.includes('a.js:10:5'));
  assert.ok(result.includes('Error 1'));
  assert.ok(result.includes('b.js:20:10'));
  assert.ok(result.includes('Error 2'));
});

test('formatDiagnostics limits output', () => {
  const diagnostics = Array.from({ length: 20 }, (_, i) => ({
    file: `file${i}.js`,
    line: i + 1,
    message: `Error ${i}`,
  }));
  
  const result = formatDiagnostics(diagnostics, 5);
  assert.ok(result.includes('Found 20 error(s)'));
  assert.ok(result.includes('...and 15 more'));
});

test('getDiagnosticSummary groups by file', () => {
  const diagnostics = [
    { file: 'a.js', line: 10, message: 'Error 1' },
    { file: 'a.js', line: 20, message: 'Error 2' },
    { file: 'b.js', line: 5, message: 'Error 3' },
  ];
  
  const summary = getDiagnosticSummary(diagnostics);
  assert.ok(summary.includes('3 error(s) across 2 file(s)'));
  assert.ok(summary.includes('a.js (2 errors)'));
  assert.ok(summary.includes('b.js (1 errors)'));
});

test('getDiagnosticSummary returns success for no errors', () => {
  const summary = getDiagnosticSummary([]);
  assert.equal(summary, 'All checks passed.');
});

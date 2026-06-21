'use strict';

/**
 * Diagnostics - Parse test/lint/typecheck output for agent context
 * 
 * Lightweight diagnostics without full LSP.
 * Parse structured output from common tools.
 */

const { spawn } = require('node:child_process');

/**
 * Common error patterns for parsing.
 */
const ERROR_PATTERNS = [
  // JavaScript/TypeScript
  /^(.+?):(\d+):(\d+): error: (.+)$/,
  /^(.+?):(\d+):(\d+) - error TS\d+: (.+)$/,
  // ESLint
  /^\s+(.+?):(\d+):(\d+)\s+error\s+(.+)$/,
  // Jest/Node test
  /^\s+at .+ \((.+?):(\d+):(\d+)\)$/,
  // Generic file:line:col: message
  /^(.+?):(\d+):(\d+): (.+)$/,
  // Generic file:line: message
  /^(.+?):(\d+): (.+)$/,
];

/**
 * Parse error output into structured diagnostics.
 * 
 * @param {string} output - command output
 * @returns {object[]} array of { file, line, column, message }
 */
function parseErrors(output) {
  const diagnostics = [];
  const lines = output.split(/\r?\n/);

  for (const line of lines) {
    for (const pattern of ERROR_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const diagnostic = {
          file: match[1]?.trim(),
          line: match[2] ? parseInt(match[2], 10) : null,
          column: match[3] ? parseInt(match[3], 10) : null,
          message: match[4]?.trim() || match[3]?.trim() || line,
        };
        
        // Skip duplicates
        if (!diagnostics.some(d => 
          d.file === diagnostic.file && 
          d.line === diagnostic.line && 
          d.message === diagnostic.message
        )) {
          diagnostics.push(diagnostic);
        }
        break;
      }
    }
  }

  return diagnostics;
}

/**
 * Run a diagnostic command and parse output.
 * 
 * @param {string} command - command to run
 * @param {string[]} args - command arguments
 * @param {object} options - { cwd, timeout }
 * @returns {Promise<object>} { exitCode, stdout, stderr, diagnostics }
 */
function runDiagnostic(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 60000,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (exitCode) => {
      const output = stdout + '\n' + stderr;
      const diagnostics = parseErrors(output);

      resolve({
        exitCode,
        stdout,
        stderr,
        diagnostics,
        passed: exitCode === 0,
      });
    });

    proc.on('error', (error) => {
      resolve({
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        diagnostics: [],
        passed: false,
        error,
      });
    });
  });
}

/**
 * Run npm test and parse failures.
 * 
 * @param {string} cwd - working directory
 * @returns {Promise<object>} diagnostic result
 */
async function runTests(cwd) {
  return await runDiagnostic('npm', ['test'], { cwd });
}

/**
 * Run TypeScript compiler and parse errors.
 * 
 * @param {string} cwd - working directory
 * @returns {Promise<object>} diagnostic result
 */
async function runTypeCheck(cwd) {
  return await runDiagnostic('npx', ['tsc', '--noEmit'], { cwd });
}

/**
 * Run ESLint and parse errors.
 * 
 * @param {string} cwd - working directory
 * @param {string} path - path to lint
 * @returns {Promise<object>} diagnostic result
 */
async function runLint(cwd, path = '.') {
  return await runDiagnostic('npx', ['eslint', path], { cwd });
}

/**
 * Format diagnostics for display.
 * 
 * @param {object[]} diagnostics - array of diagnostics
 * @param {number} limit - max diagnostics to show
 * @returns {string} formatted output
 */
function formatDiagnostics(diagnostics, limit = 10) {
  if (diagnostics.length === 0) {
    return 'No errors found.';
  }

  const lines = [`Found ${diagnostics.length} error(s):\n`];
  const shown = diagnostics.slice(0, limit);

  for (const d of shown) {
    const location = d.column ? `${d.file}:${d.line}:${d.column}` : `${d.file}:${d.line}`;
    lines.push(`  ${location}`);
    lines.push(`    ${d.message}`);
  }

  if (diagnostics.length > limit) {
    lines.push(`\n...and ${diagnostics.length - limit} more`);
  }

  return lines.join('\n');
}

/**
 * Get diagnostic summary for agent context.
 * 
 * @param {object[]} diagnostics - array of diagnostics
 * @returns {string} summary for agent
 */
function getDiagnosticSummary(diagnostics) {
  if (diagnostics.length === 0) {
    return 'All checks passed.';
  }

  const byFile = {};
  for (const d of diagnostics) {
    if (!byFile[d.file]) byFile[d.file] = [];
    byFile[d.file].push(d);
  }

  const summary = [`${diagnostics.length} error(s) across ${Object.keys(byFile).length} file(s):\n`];

  for (const [file, errors] of Object.entries(byFile)) {
    summary.push(`${file} (${errors.length} errors):`);
    for (const error of errors.slice(0, 3)) {
      summary.push(`  Line ${error.line}: ${error.message.slice(0, 80)}`);
    }
    if (errors.length > 3) {
      summary.push(`  ...and ${errors.length - 3} more`);
    }
  }

  return summary.join('\n');
}

module.exports = {
  parseErrors,
  runDiagnostic,
  runTests,
  runTypeCheck,
  runLint,
  formatDiagnostics,
  getDiagnosticSummary,
};

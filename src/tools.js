'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { HEAVY_DIRS } = require('./profile');

const DEFAULT_READ_LIMIT = 128 * 1024;
const DEFAULT_MATCH_LIMIT = 100;

function resolveInside(root, target) {
  const resolved = path.resolve(root, target || '.');
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`Path escapes workspace: ${target}`);
  return resolved;
}

async function readFileTool(root, target, { limit = DEFAULT_READ_LIMIT } = {}) {
  const file = resolveInside(root, target);
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buffer, 0, limit + 1, 0);
    const truncated = bytesRead > limit;
    return {
      path: path.relative(root, file) || '.',
      truncated,
      content: buffer.subarray(0, Math.min(bytesRead, limit)).toString('utf8')
    };
  } finally {
    await handle.close();
  }
}

async function* walk(root, dir, options = {}) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && HEAVY_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(root, full, options);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function editFileTool(root, target, oldText, newText) {
  if (!target) throw new Error('edit_file path required');
  if (typeof oldText !== 'string' || oldText.length === 0) throw new Error('edit_file old_text required');
  if (typeof newText !== 'string') throw new Error('edit_file new_text must be string');
  const file = resolveInside(root, target);
  const content = await fs.readFile(file, 'utf8');
  const first = content.indexOf(oldText);
  if (first === -1) throw new Error('old_text not found');
  if (content.indexOf(oldText, first + oldText.length) !== -1) throw new Error('old_text is not unique');
  const next = `${content.slice(0, first)}${newText}${content.slice(first + oldText.length)}`;
  await fs.writeFile(file, next, 'utf8');
  return {
    path: path.relative(root, file) || '.',
    replaced_bytes: Buffer.byteLength(oldText),
    inserted_bytes: Buffer.byteLength(newText)
  };
}

async function searchTool(root, pattern, dir = '.', { limit = DEFAULT_MATCH_LIMIT, readLimit = DEFAULT_READ_LIMIT } = {}) {
  if (!pattern) throw new Error('search pattern required');
  const start = resolveInside(root, dir);
  const matches = [];
  const needle = String(pattern);
  for await (const file of walk(root, start)) {
    let text;
    try {
      const result = await readFileTool(root, path.relative(root, file), { limit: readLimit });
      text = result.content;
      if (text.includes('\u0000')) continue;
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes(needle)) {
        matches.push({ file: path.relative(root, file), line: i + 1, text: lines[i] });
        if (matches.length >= limit) return { pattern: needle, truncated: true, matches };
      }
    }
  }
  return { pattern: needle, truncated: false, matches };
}

function runCommandTool(root, command, args = [], { timeoutMs = 120000 } = {}) {
  if (!command) return Promise.reject(new Error('command required'));
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const cap = 256 * 1024;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout = (stdout + chunk.toString('utf8')).slice(-cap);
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-cap);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, signal: null, stdout, stderr: String(error.message), error: error.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

module.exports = {
  readFileTool,
  editFileTool,
  searchTool,
  runCommandTool,
  resolveInside
};

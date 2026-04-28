'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * JSONL and JSON Patch utilities.
 */

async function appendJsonLine(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(value)}\n`, 'utf8');
}

async function readAllJsonLines(file, { limit = 10000 } = {}) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const target = lines.length <= limit ? lines : lines.slice(-limit);
    return target.map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readRecentJsonLines(file, { limit = 20 } = {}) {
  return (await readAllJsonLines(file, { limit })).slice(-limit);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parseJsonPointer(pointer) {
  if (pointer === '') return [];
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error(`Invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function getParent(target, path, createMissing = false) {
  const segments = parseJsonPointer(path);
  if (segments.length === 0) return { parent: null, key: null };
  let node = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (node == null || typeof node !== 'object') throw new Error(`Cannot traverse ${path}`);
    if (!(segment in node)) {
      if (!createMissing) throw new Error(`Missing parent for ${path}`);
      const nextSegment = segments[i + 1];
      node[segment] = nextSegment === '-' || /^\d+$/.test(nextSegment) ? [] : {};
    }
    node = node[segment];
  }
  return { parent: node, key: segments[segments.length - 1] };
}

function applyJsonPatch(document, patch) {
  if (!Array.isArray(patch)) throw new Error('patch must be an array');
  const next = clone(document) || {};
  for (const op of patch) {
    if (!op || typeof op !== 'object') throw new Error('patch op must be an object');
    if (!['add', 'replace', 'remove'].includes(op.op)) throw new Error(`Unsupported patch op: ${op.op}`);
    const { parent, key } = getParent(next, op.path, op.op === 'add');
    if (parent === null) {
      if (op.op === 'remove') throw new Error('Cannot remove document root');
      return clone(op.value);
    }
    if (Array.isArray(parent)) {
      if (op.op === 'add') {
        if (key === '-') parent.push(clone(op.value));
        else parent.splice(Number(key), 0, clone(op.value));
      } else if (op.op === 'replace') {
        if (!(key in parent)) throw new Error(`Missing path: ${op.path}`);
        parent[Number(key)] = clone(op.value);
      } else {
        if (!(key in parent)) throw new Error(`Missing path: ${op.path}`);
        parent.splice(Number(key), 1);
      }
      continue;
    }
    if (op.op === 'add' || op.op === 'replace') {
      if (op.op === 'replace' && !(key in parent)) throw new Error(`Missing path: ${op.path}`);
      parent[key] = clone(op.value);
    } else {
      if (!(key in parent)) throw new Error(`Missing path: ${op.path}`);
      delete parent[key];
    }
  }
  return next;
}

module.exports = {
  appendJsonLine,
  readAllJsonLines,
  readRecentJsonLines,
  applyJsonPatch,
  parseJsonPointer,
  getParentByPointer: getParent
};

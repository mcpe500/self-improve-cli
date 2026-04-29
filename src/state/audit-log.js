'use strict';

const fs = require('node:fs/promises');
const { appendJsonLine } = require('../json-utils');
const {
  EVENTS_LOG, PATCHES_LOG, TRACES_LOG,
  statePath, exists
} = require('./common');

async function appendEvent(root, event) {
  const record = {
    ts: new Date().toISOString(),
    ...event
  };
  await appendJsonLine(statePath(root, EVENTS_LOG), record);
  return record;
}

async function appendTrace(root, trace) {
  const record = {
    ts: new Date().toISOString(),
    ...trace
  };
  await appendJsonLine(statePath(root, TRACES_LOG), record);
  return record;
}

async function appendPatchAudit(root, audit) {
  const record = {
    ts: new Date().toISOString(),
    ...audit
  };
  await appendJsonLine(statePath(root, PATCHES_LOG), record);
  return record;
}

async function countJsonLines(file) {
  if (!(await exists(file))) return 0;
  const raw = await fs.readFile(file, 'utf8');
  return raw.split(/\r?\n/).filter(Boolean).length;
}

async function readAllJsonLines(file, { limit = 10000 } = {}) {
  if (!(await exists(file))) return [];
  const raw = await fs.readFile(file, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= limit) return lines.map(line => JSON.parse(line));
  return lines.slice(-limit).map(line => JSON.parse(line));
}

async function readRecentJsonLines(file, limit = 20) {
  return (await readAllJsonLines(file, { limit })).slice(-limit);
}

async function getTraceCount(root) {
  const fp = statePath(root, TRACES_LOG);
  return countJsonLines(fp);
}

module.exports = {
  appendEvent,
  appendTrace,
  appendPatchAudit,
  countJsonLines,
  readAllJsonLines,
  readRecentJsonLines,
  getTraceCount
};

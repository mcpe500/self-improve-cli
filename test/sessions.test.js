'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  generateSessionId,
  createSession,
  listSessions,
  loadSession,
  saveSession,
  addMessage,
  deleteSession,
  exportToMarkdown,
  getActiveSessionId,
  setActiveSessionId,
} = require('../src/sessions');

test('generateSessionId creates unique IDs', () => {
  const id1 = generateSessionId();
  const id2 = generateSessionId();
  assert.equal(typeof id1, 'string');
  assert.equal(id1.length, 16); // 8 bytes hex = 16 chars
  assert.notEqual(id1, id2);
});

test('createSession creates new session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir, {
    title: 'Test Session',
    mode: 'plan',
    provider: 'openai',
    model: 'gpt-4',
  });

  assert.equal(session.title, 'Test Session');
  assert.equal(session.mode, 'plan');
  assert.equal(session.provider, 'openai');
  assert.equal(session.model, 'gpt-4');
  assert.ok(Array.isArray(session.messages));
  assert.equal(session.messages.length, 0);

  await fs.rm(tmpDir, { recursive: true });
});

test('createSession uses defaults', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir);

  assert.equal(session.title, 'Untitled Session');
  assert.equal(session.mode, 'build');

  await fs.rm(tmpDir, { recursive: true });
});

test('listSessions returns empty array for no sessions', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const sessions = await listSessions(tmpDir);
  assert.deepEqual(sessions, []);
  await fs.rm(tmpDir, { recursive: true });
});

test('listSessions returns session metadata', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  await createSession(tmpDir, { title: 'Session 1' });
  await createSession(tmpDir, { title: 'Session 2' });

  const sessions = await listSessions(tmpDir);
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].id);
  assert.ok(sessions[0].title);
  assert.ok(sessions[0].created);
  assert.equal(typeof sessions[0].messageCount, 'number');

  await fs.rm(tmpDir, { recursive: true });
});

test('loadSession returns session by ID', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const created = await createSession(tmpDir, { title: 'Load Test' });
  const loaded = await loadSession(tmpDir, created.id);

  assert.deepEqual(loaded, created);

  await fs.rm(tmpDir, { recursive: true });
});

test('loadSession returns null for missing session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const loaded = await loadSession(tmpDir, 'nonexistent');
  assert.equal(loaded, null);
  await fs.rm(tmpDir, { recursive: true });
});

test('saveSession updates session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir, { title: 'Original' });
  session.title = 'Updated';
  await saveSession(tmpDir, session);

  const loaded = await loadSession(tmpDir, session.id);
  assert.equal(loaded.title, 'Updated');

  await fs.rm(tmpDir, { recursive: true });
});

test('addMessage adds message to session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir);
  await addMessage(tmpDir, session.id, {
    role: 'user',
    content: 'Hello',
  });

  const loaded = await loadSession(tmpDir, session.id);
  assert.equal(loaded.messages.length, 1);
  assert.equal(loaded.messages[0].role, 'user');
  assert.equal(loaded.messages[0].content, 'Hello');
  assert.ok(loaded.messages[0].timestamp);

  await fs.rm(tmpDir, { recursive: true });
});

test('addMessage throws for missing session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  await assert.rejects(
    async () => await addMessage(tmpDir, 'nonexistent', { role: 'user', content: 'Hi' }),
    /Session not found: nonexistent/
  );
  await fs.rm(tmpDir, { recursive: true });
});

test('deleteSession removes session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir);
  await deleteSession(tmpDir, session.id);

  const loaded = await loadSession(tmpDir, session.id);
  assert.equal(loaded, null);

  await fs.rm(tmpDir, { recursive: true });
});

test('deleteSession does not throw for missing session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  await deleteSession(tmpDir, 'nonexistent'); // Should not throw
  await fs.rm(tmpDir, { recursive: true });
});

test('exportToMarkdown exports session', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir, { title: 'Export Test' });
  await addMessage(tmpDir, session.id, { role: 'user', content: 'Question' });
  await addMessage(tmpDir, session.id, { role: 'assistant', content: 'Answer' });

  const markdown = await exportToMarkdown(tmpDir, session.id);
  assert.ok(markdown.includes('# Export Test'));
  assert.ok(markdown.includes('## You'));
  assert.ok(markdown.includes('Question'));
  assert.ok(markdown.includes('## Agent'));
  assert.ok(markdown.includes('Answer'));

  await fs.rm(tmpDir, { recursive: true });
});

test('getActiveSessionId returns null initially', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const activeId = await getActiveSessionId(tmpDir);
  assert.equal(activeId, null);
  await fs.rm(tmpDir, { recursive: true });
});

test('setActiveSessionId and getActiveSessionId work', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const session = await createSession(tmpDir);
  await setActiveSessionId(tmpDir, session.id);

  const activeId = await getActiveSessionId(tmpDir);
  assert.equal(activeId, session.id);

  await fs.rm(tmpDir, { recursive: true });
});

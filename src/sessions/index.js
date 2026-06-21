'use strict';

/**
 * Sessions Management - Track and resume conversations
 * 
 * Sessions allow users to:
 * - Save conversation history
 * - Resume previous conversations
 * - Export sessions to markdown
 * - Switch between multiple sessions
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * Generate a unique session ID.
 */
function generateSessionId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Get sessions directory path.
 */
function getSessionsDir(root) {
  return path.join(root, '.selfimprove', 'sessions');
}

/**
 * Create a new session.
 * 
 * @param {string} root - workspace root
 * @param {object} options - { title, mode, provider, model }
 * @returns {Promise<object>} session object
 */
async function createSession(root, options = {}) {
  const sessionsDir = getSessionsDir(root);
  await fs.mkdir(sessionsDir, { recursive: true });

  const session = {
    id: generateSessionId(),
    title: options.title || 'Untitled Session',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    mode: options.mode || 'build',
    provider: options.provider || 'unknown',
    model: options.model || 'unknown',
    messages: [],
  };

  const filepath = path.join(sessionsDir, `${session.id}.json`);
  await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf8');

  return session;
}

/**
 * List all sessions.
 * 
 * @param {string} root - workspace root
 * @returns {Promise<object[]>} array of session metadata
 */
async function listSessions(root) {
  const sessionsDir = getSessionsDir(root);
  
  try {
    const files = await fs.readdir(sessionsDir);
    const sessions = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filepath = path.join(sessionsDir, file);
      const content = await fs.readFile(filepath, 'utf8');
      const session = JSON.parse(content);
      
      // Return metadata only (not full messages)
      sessions.push({
        id: session.id,
        title: session.title,
        created: session.created,
        updated: session.updated,
        mode: session.mode,
        provider: session.provider,
        model: session.model,
        messageCount: session.messages?.length || 0,
      });
    }

    // Sort by updated (newest first)
    sessions.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    return sessions;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Load a session by ID.
 * 
 * @param {string} root - workspace root
 * @param {string} id - session ID
 * @returns {Promise<object|null>} session object or null
 */
async function loadSession(root, id) {
  const filepath = path.join(getSessionsDir(root), `${id}.json`);
  
  try {
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Save/update a session.
 * 
 * @param {string} root - workspace root
 * @param {object} session - session object
 */
async function saveSession(root, session) {
  const sessionsDir = getSessionsDir(root);
  await fs.mkdir(sessionsDir, { recursive: true });

  session.updated = new Date().toISOString();
  const filepath = path.join(sessionsDir, `${session.id}.json`);
  await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf8');
}

/**
 * Add a message to a session.
 * 
 * @param {string} root - workspace root
 * @param {string} id - session ID
 * @param {object} message - { role: 'user'|'assistant'|'system', content, timestamp }
 */
async function addMessage(root, id, message) {
  const session = await loadSession(root, id);
  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }

  session.messages.push({
    ...message,
    timestamp: message.timestamp || new Date().toISOString(),
  });

  await saveSession(root, session);
}

/**
 * Delete a session.
 * 
 * @param {string} root - workspace root
 * @param {string} id - session ID
 */
async function deleteSession(root, id) {
  const filepath = path.join(getSessionsDir(root), `${id}.json`);
  
  try {
    await fs.unlink(filepath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

/**
 * Export a session to markdown.
 * 
 * @param {string} root - workspace root
 * @param {string} id - session ID
 * @returns {Promise<string>} markdown content
 */
async function exportToMarkdown(root, id) {
  const session = await loadSession(root, id);
  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }

  const lines = [
    `# ${session.title}`,
    '',
    `**Created**: ${new Date(session.created).toLocaleString()}`,
    `**Updated**: ${new Date(session.updated).toLocaleString()}`,
    `**Mode**: ${session.mode}`,
    `**Provider**: ${session.provider}`,
    `**Model**: ${session.model}`,
    '',
    '---',
    '',
  ];

  for (const message of session.messages) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const role = message.role === 'user' ? 'You' :
                 message.role === 'assistant' ? 'Agent' :
                 'System';
    
    lines.push(`## ${role} [${timestamp}]`);
    lines.push('');
    lines.push(message.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get the current active session ID from state.
 * 
 * @param {string} root - workspace root
 * @returns {Promise<string|null>}
 */
async function getActiveSessionId(root) {
  const stateFile = path.join(root, '.selfimprove', 'session-state.json');
  
  try {
    const content = await fs.readFile(stateFile, 'utf8');
    const state = JSON.parse(content);
    return state.activeSessionId || null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Set the active session ID.
 * 
 * @param {string} root - workspace root
 * @param {string} id - session ID
 */
async function setActiveSessionId(root, id) {
  const stateFile = path.join(root, '.selfimprove', 'session-state.json');
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify({ activeSessionId: id }, null, 2), 'utf8');
}

module.exports = {
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
};

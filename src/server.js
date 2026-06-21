'use strict';

/**
 * Server/API Mode (P2)
 *
 * Headless HTTP server exposing agent endpoints so external clients
 * (scripts, automation, future IDE extensions) can drive sicli.
 *
 * Uses port 3848 by default (daemon uses 3847 — no conflict).
 */

const http = require('http');
const { URL } = require('url');
const { loadConfig } = require('./config');
const { listSessions, loadSession, createSession, addMessage, exportToMarkdown } = require('./sessions');
const { listAllAgents, resolveAgent } = require('./agents');

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleGetStatus(root, req, res) {
  const config = await loadConfig(root);
  sendJson(res, 200, {
    status: 'ok',
    version: require('../package.json').version,
    workspace: root,
    provider: config.active_provider,
    model: config.active_model,
    permission_mode: config.permission_mode,
  });
}

async function handleGetConfig(root, req, res) {
  const config = await loadConfig(root);
  // Don't leak secrets
  const safe = { ...config };
  if (safe.api_key) delete safe.api_key;
  sendJson(res, 200, safe);
}

async function handleGetAgents(root, req, res) {
  const config = await loadConfig(root);
  const agents = listAllAgents(config).map((a) => ({
    name: a.name,
    description: a.description,
    mode: a.mode,
    custom: !!a.custom,
  }));
  sendJson(res, 200, { agents });
}

async function handleGetSessions(root, req, res) {
  const sessions = await listSessions(root);
  sendJson(res, 200, { sessions });
}

async function handleGetSession(root, req, res, url) {
  const id = url.searchParams.get('id');
  if (!id) {
    sendJson(res, 400, { error: 'Missing id parameter' });
    return;
  }
  const session = await loadSession(root, id);
  if (!session) {
    sendJson(res, 404, { error: 'Session not found' });
    return;
  }
  sendJson(res, 200, session);
}

async function handlePostSession(root, req, res) {
  const body = await readBody(req);
  const opts = JSON.parse(body || '{}');
  const session = await createSession(root, opts);
  sendJson(res, 201, session);
}

async function handlePostMessage(root, req, res) {
  const body = await readBody(req);
  const { sessionId, role, content } = JSON.parse(body || '{}');
  if (!sessionId || !content) {
    sendJson(res, 400, { error: 'Missing sessionId or content' });
    return;
  }
  try {
    await addMessage(root, sessionId, { role: role || 'user', content });
    sendJson(res, 201, { added: true });
  } catch (error) {
    sendJson(res, 404, { error: error.message });
  }
}

async function handleGetExport(root, req, res, url) {
  const id = url.searchParams.get('id');
  if (!id) {
    sendJson(res, 400, { error: 'Missing id parameter' });
    return;
  }
  try {
    const markdown = await exportToMarkdown(root, id);
    res.writeHead(200, { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' });
    res.end(markdown);
  } catch (error) {
    sendJson(res, 404, { error: error.message });
  }
}

async function handlePostRun(root, req, res) {
  const body = await readBody(req);
  const { prompt, agent, yes } = JSON.parse(body || '{}');
  if (!prompt) {
    sendJson(res, 400, { error: 'Missing prompt' });
    return;
  }

  try {
    const { runAgentTask } = require('./agent');
    const result = await runAgentTask(root, prompt, {
      interactive: false,
      yes: yes !== false,
      trace: false,
      agentName: agent,
    });
    sendJson(res, 200, { ok: true, text: result.text || '', result });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

/**
 * Create and start the server.
 */
function createServer(root, port = 3848) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
      }

      // GET routes
      if (req.method === 'GET') {
        if (url.pathname === '/status') return await handleGetStatus(root, req, res);
        if (url.pathname === '/config') return await handleGetConfig(root, req, res);
        if (url.pathname === '/agents') return await handleGetAgents(root, req, res);
        if (url.pathname === '/sessions') return await handleGetSessions(root, req, res);
        if (url.pathname === '/session') return await handleGetSession(root, req, res, url);
        if (url.pathname === '/export') return await handleGetExport(root, req, res, url);
        sendJson(res, 404, { error: 'Not found', path: url.pathname });
        return;
      }

      // POST routes
      if (req.method === 'POST') {
        if (url.pathname === '/sessions') return await handlePostSession(root, req, res);
        if (url.pathname === '/message') return await handlePostMessage(root, req, res);
        if (url.pathname === '/run') return await handlePostRun(root, req, res);
        sendJson(res, 404, { error: 'Not found', path: url.pathname });
        return;
      }

      sendJson(res, 405, { error: 'Method not allowed' });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = {
  createServer,
  // Export handlers for testing
  handleGetStatus,
  handleGetAgents,
  handleGetSessions,
};

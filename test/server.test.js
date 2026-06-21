'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createServer } = require('../src/server');

async function setupWorkspace() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-server-'));
  await fs.mkdir(path.join(dir, '.selfimprove'), { recursive: true });
  await fs.writeFile(
    path.join(dir, '.selfimprove', 'config.json'),
    JSON.stringify({ active_provider: 'openai', active_model: 'gpt-4', permission_mode: 'secure' })
  );
  return dir;
}

async function fetchJson(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function withServer(fn) {
  const root = await setupWorkspace();
  const port = 40000 + Math.floor(Math.random() * 9999);
  const server = await createServer(root, port);
  try {
    await fn(port, root);
  } finally {
    server.close();
    await fs.rm(root, { recursive: true });
  }
}

test('GET /status returns server info', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.version);
    assert.equal(res.body.provider, 'openai');
  });
});

test('GET /config returns config without secrets', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/config');
    assert.equal(res.status, 200);
    assert.equal(res.body.active_provider, 'openai');
    assert.equal(res.body.api_key, undefined);
  });
});

test('GET /agents returns built-in agents', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/agents');
    assert.equal(res.status, 200);
    const names = res.body.agents.map((a) => a.name);
    assert.ok(names.includes('plan'));
    assert.ok(names.includes('build'));
    assert.ok(names.includes('explore'));
    assert.ok(names.includes('scout'));
  });
});

test('GET /sessions returns empty list initially', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/sessions');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.sessions));
  });
});

test('POST /sessions creates new session', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/sessions', {
      method: 'POST',
      body: { title: 'Test' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'Test');
    assert.ok(res.body.id);
  });
});

test('GET /session?id=X returns session', async () => {
  await withServer(async (port) => {
    const create = await fetchJson(port, '/sessions', {
      method: 'POST',
      body: { title: 'Find Me' },
    });
    const res = await fetchJson(port, `/session?id=${create.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Find Me');
  });
});

test('GET /session without id returns 400', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/session');
    assert.equal(res.status, 400);
  });
});

test('GET /session with bad id returns 404', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/session?id=nonexistent');
    assert.equal(res.status, 404);
  });
});

test('POST /message adds to session', async () => {
  await withServer(async (port) => {
    const create = await fetchJson(port, '/sessions', {
      method: 'POST',
      body: { title: 'Msg' },
    });
    const res = await fetchJson(port, '/message', {
      method: 'POST',
      body: { sessionId: create.body.id, role: 'user', content: 'hello' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.added, true);
  });
});

test('POST /message without content returns 400', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/message', {
      method: 'POST',
      body: { sessionId: 'x' },
    });
    assert.equal(res.status, 400);
  });
});

test('GET /export?id=X returns markdown', async () => {
  await withServer(async (port) => {
    const create = await fetchJson(port, '/sessions', {
      method: 'POST',
      body: { title: 'Export Test' },
    });
    await fetchJson(port, '/message', {
      method: 'POST',
      body: { sessionId: create.body.id, content: 'test msg' },
    });
    const res = await fetchJson(port, `/export?id=${create.body.id}`);
    assert.equal(res.status, 200);
  });
});

test('GET unknown route returns 404', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/unknown');
    assert.equal(res.status, 404);
  });
});

test('OPTIONS returns 204 for CORS preflight', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/status', { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });
});

test('POST /run without prompt returns 400', async () => {
  await withServer(async (port) => {
    const res = await fetchJson(port, '/run', { method: 'POST', body: {} });
    assert.equal(res.status, 400);
  });
});

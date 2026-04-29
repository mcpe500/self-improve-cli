'use strict';

const http = require('http');
const {
  readDaemonState,
  writeDaemonState,
  readDaemonPid,
  loadCandidateScores,
  listCandidates
} = require('./state');

function createApiServer(root, port, controller) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${port}`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.method === 'GET' && url.pathname === '/status') {
        const state = await readDaemonState(root);
        const pid = await readDaemonPid(root);
        res.writeHead(200);
        res.end(JSON.stringify({ ...state, pid }, null, 2));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/candidates') {
        const ids = await listCandidates(root);
        const candidates = [];
        for (const id of ids) {
          try {
            const scores = await loadCandidateScores(root, id);
            candidates.push({ id, ...scores });
          } catch {
            candidates.push({ id });
          }
        }
        res.writeHead(200);
        res.end(JSON.stringify(candidates, null, 2));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/trigger') {
        console.log('[daemon] /trigger received — will evaluate on next loop iteration');
        const state = await readDaemonState(root);
        await writeDaemonState(root, { ...state, triggered: true });
        res.writeHead(202);
        res.end(JSON.stringify({ triggered: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/stop') {
        console.log('[daemon] /stop received');
        controller.stop();
        controller.gracefulShutdown().catch(() => {});
        res.writeHead(202);
        res.end(JSON.stringify({ stopping: true }));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'not found' }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[daemon] API server listening on http://127.0.0.1:${port}`);
  });

  server.on('error', (err) => {
    console.error(`[daemon] HTTP server error: ${err.message}`);
  });

  return server;
}

module.exports = { createApiServer };

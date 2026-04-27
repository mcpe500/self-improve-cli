'use strict';

const http = require('http');
const {
  readDaemonState,
  writeDaemonState,
  writeDaemonPid,
  readDaemonPid,
  clearDaemonPid,
  getTraceCount,
  isDaemonRunning,
  statePath
} = require('./state');
const { runSelfImprovePropose } = require('./self-improve');
const { loadConfig } = require('./config');
const path = require('path');

let running = false;
let httpServer = null;
let shutdownTimer = null;

async function runDaemonLoop(root, options = {}) {
  const {
    intervalMinutes = 15,
    port = 3847,
    autoPromote = true,
    autoPromoteThreshold = 0.8
  } = options;

  running = true;
  const intervalMs = intervalMinutes * 60 * 1000;
  const checkIntervalMs = 60000;
  let lastTraceCount = 0;
  let lastRunAt = null;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  await writeDaemonState(root, {
    status: 'running',
    started_at: new Date().toISOString(),
    last_run: null,
    last_trace_count: 0,
    consecutive_errors: 0,
    current_candidate: null,
    last_result: null,
    interval_minutes: intervalMinutes,
    port,
    auto_promote: autoPromote
  });

  startApiServer(root, port);

  mainLoop(root, intervalMs, checkIntervalMs, autoPromote, autoPromoteThreshold);

  return { status: 'started' };
}

async function mainLoop(root, intervalMs, checkIntervalMs, autoPromote, autoPromoteThreshold) {
  while (running) {
    try {
      const state = await readDaemonState(root);
      const currentTraceCount = await getTraceCount(root);
      const elapsed = state.last_run
        ? Date.now() - new Date(state.last_run).getTime()
        : Infinity;
      const newFailures = currentTraceCount > (state.last_trace_count || 0);
      const intervalElapsed = elapsed >= intervalMs;

      if (newFailures) {
        console.log(`[daemon] New failures detected (${currentTraceCount} traces), triggering evaluation`);
        const result = await runSelfImprovePropose(root, { autoPromote, threshold: autoPromoteThreshold });
        await handleProposeResult(root, result, currentTraceCount, autoPromote, autoPromoteThreshold);
        consecutiveErrors = 0;
      } else if (intervalElapsed) {
        console.log(`[daemon] Interval elapsed (${Math.round(elapsed / 60000)}min), triggering evaluation`);
        const result = await runSelfImprovePropose(root, { autoPromote, threshold: autoPromoteThreshold });
        await handleProposeResult(root, result, currentTraceCount, autoPromote, autoPromoteThreshold);
        consecutiveErrors = 0;
      }

      await sleep(checkIntervalMs);
    } catch (err) {
      consecutiveErrors++;
      console.error(`[daemon] Error in main loop (${consecutiveErrors}/5):`, err.message);
      const state = await readDaemonState(root);
      await writeDaemonState(root, {
        ...state,
        status: 'error',
        error: err.message,
        consecutive_errors: consecutiveErrors
      });
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`[daemon] Too many consecutive errors (${consecutiveErrors}), stopping`);
        await gracefulShutdown(root);
        break;
      }
      await sleep(checkIntervalMs);
    }
  }
}

async function handleProposeResult(root, result, currentTraceCount, autoPromote, autoPromoteThreshold) {
  const state = await readDaemonState(root);

  if (result.promoted) {
    console.log(`[daemon] Candidate ${result.candidate_id} auto-promoted`);
    await writeDaemonState(root, {
      ...state,
      status: 'idle',
      last_run: new Date().toISOString(),
      last_trace_count: currentTraceCount,
      consecutive_errors: 0,
      current_candidate: result.candidate_id,
      last_result: { promoted: true, candidate_id: result.candidate_id, reason: result.reason },
      error: null
    });
  } else if (result.candidate_id) {
    console.log(`[daemon] Candidate ${result.candidate_id} evaluated but not promoted: ${result.reason}`);
    await writeDaemonState(root, {
      ...state,
      status: 'idle',
      last_run: new Date().toISOString(),
      last_trace_count: currentTraceCount,
      consecutive_errors: 0,
      current_candidate: result.candidate_id,
      last_result: { promoted: false, candidate_id: result.candidate_id, reason: result.reason },
      error: null
    });
  } else {
    console.log(`[daemon] No candidate proposed: ${result.reason || 'unknown'}`);
    await writeDaemonState(root, {
      ...state,
      status: 'idle',
      last_run: new Date().toISOString(),
      last_trace_count: currentTraceCount,
      consecutive_errors: 0,
      last_result: { proposed: false, reason: result.reason },
      error: null
    });
  }
}

function startApiServer(root, port) {
  httpServer = http.createServer(async (req, res) => {
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
      const { listCandidates } = require('./self-improve');
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
      running = false;
      gracefulShutdown(root).catch(() => {});
      res.writeHead(202);
      res.end(JSON.stringify({ stopping: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'not found' }));
  });

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`[daemon] API server listening on http://127.0.0.1:${port}`);
  });

  httpServer.on('error', (err) => {
    console.error(`[daemon] HTTP server error: ${err.message}`);
  });
}

async function gracefulShutdown(root) {
  console.log('[daemon] Shutting down gracefully...');
  running = false;

  if (httpServer) {
    await new Promise(resolve => httpServer.close(resolve));
    httpServer = null;
  }

  const state = await readDaemonState(root);
  await writeDaemonState(root, {
    ...state,
    status: 'stopped',
    stopped_at: new Date().toISOString()
  });

  await clearDaemonPid(root);
  console.log('[daemon] Stopped');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadCandidateScores(root, id) {
  const { loadCandidateScores: lcs } = await import('./self-improve');
  return lcs(root, id);
}

module.exports = {
  runDaemonLoop,
  gracefulShutdown,
  isDaemonRunning,
  readDaemonPid,
  clearDaemonPid
};

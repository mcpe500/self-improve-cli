const { parentPort, workerData } = require('worker_threads');

const { task, harnessConfig, taskIndex } = workerData;

parentPort.postMessage({ type: 'start', taskIndex });

try {
  const result = executeTask(task, harnessConfig);
  parentPort.postMessage({ type: 'result', taskIndex, ...result });
} catch (err) {
  parentPort.postMessage({ type: 'error', taskIndex, error: err.message });
}

function executeTask(task, harness) {
  // Simulate task execution — in real impl, this would invoke agent.js
  // with the candidate harness config and return pass/fail + tokens
  const start = Date.now();
  let passed = false;
  let tokens = 0;

  // For synthetic tasks: check if harness addresses the failure mode
  if (task.type === 'synthetic') {
    const failureMode = task.failure_mode || '';
    const harnessVal = JSON.stringify(harness);
    // Simple heuristic: if harness config addresses the failure, pass
    // This is a placeholder — real impl uses actual agent execution
    passed = simulateTaskResult(task, harness);
  } else if (task.type === 'trace') {
    // Trace replay: simulate re-running the trace with candidate harness
    passed = simulateTraceResult(task, harness);
  }

  tokens = Math.floor(Math.random() * 2000) + 500; // placeholder token count

  return {
    passed,
    tokens,
    duration_ms: Date.now() - start,
    task_id: task.id || task.task_id
  };
}

function simulateTaskResult(task, harness) {
  // Placeholder: 70% pass rate for simulation
  // Real implementation does actual agent.js invocation
  return Math.random() > 0.3;
}

function simulateTraceResult(task, harness) {
  // Placeholder: 60% pass rate for trace replay
  return Math.random() > 0.4;
}
const { Worker } = require('worker_threads');
const os = require('os');
const path = require('path');

class WorkerPool {
  constructor({ poolSize = 4 } = {}) {
    this.poolSize = poolSize;
    this.workers = [];
    this.pending = [];
    this.active = 0;
  }

  async dispatch(task, harnessConfig, taskIndex) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, harnessConfig, taskIndex, resolve, reject });
      this.processQueue();
    });
  }

  processQueue() {
    while (this.pending.length > 0 && this.active < this.poolSize) {
      const { task, harnessConfig, taskIndex, resolve, reject } = this.pending.shift();
      this.active++;
      this.spawnWorker(task, harnessConfig, taskIndex, resolve, reject);
    }
  }

  spawnWorker(task, harnessConfig, taskIndex, resolve, reject) {
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { task, harnessConfig, taskIndex }
    });

    const cleanup = () => {
      this.active--;
      worker.terminate();
      this.processQueue();
    };

    worker.on('message', (msg) => {
      if (msg.type === 'start') {
        // Worker started
      } else if (msg.type === 'result') {
        cleanup();
        resolve({
          taskIndex: msg.taskIndex,
          passed: msg.passed,
          tokens: msg.tokens,
          duration_ms: msg.duration_ms,
          task_id: msg.task_id
        });
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.error));
      }
    });

    worker.on('error', (err) => {
      cleanup();
      reject(err);
    });
  }

  async runAll(tasks, harnessConfig) {
    const results = await Promise.all(
      tasks.map((task, i) => this.dispatch(task, harnessConfig, i))
    );
    return results;
  }

  async runWithTimeout(tasks, harnessConfig, timeoutMs = 120000) {
    return Promise.race([
      this.runAll(tasks, harnessConfig),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pool timeout')), timeoutMs)
      )
    ]);
  }
}

module.exports = { WorkerPool };

if (require.main === module) {
  // Allow running worker.js directly for testing
  const { WorkerPool } = require('./worker_pool');
  const pool = new WorkerPool({ poolSize: 2 });
  const testTasks = [
    { id: 'test1', type: 'synthetic', failure_mode: 'missing_context' },
    { id: 'test2', type: 'synthetic', failure_mode: 'shell_redirection' }
  ];
  pool.runAll(testTasks, { max_tool_turns: 10 })
    .then(results => console.log(JSON.stringify(results, null, 2)))
    .catch(err => console.error(err.message));
}
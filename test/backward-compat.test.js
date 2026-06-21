'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'bin', 'self-improve-cli.js');

function runCLI(args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI, ...args], {
      timeout,
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => { stdout += data; });
    proc.stderr.on('data', data => { stderr += data; });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);

    // Prevent hanging on interactive commands
    setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({ code: 124, stdout, stderr, timeout: true });
    }, timeout);
  });
}

test('sicli --help shows usage', async () => {
  const result = await runCLI(['--help']);
  assert.ok(result.stdout.includes('Usage:') || result.stdout.includes('sicli'), 'should show usage');
});

test('sicli --help includes version or usage info', async () => {
  const result = await runCLI(['--help']);
  assert.equal(result.code, 0, 'should exit cleanly');
  assert.ok(result.stdout.includes('sicli') || result.stdout.includes('Usage'), 'should show usage');
});

test('sicli config show works', async () => {
  const result = await runCLI(['config', 'show']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli status works', async () => {
  const result = await runCLI(['status']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli provider list works', async () => {
  const result = await runCLI(['provider', 'list']);
  assert.equal(result.code, 0, 'should exit cleanly');
  assert.ok(result.stdout.includes('OpenAI') || result.stdout.includes('provider'), 'should list providers');
});

test('sicli superpowers list works', async () => {
  const result = await runCLI(['superpowers', 'list']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli tool read works for package.json', async () => {
  const result = await runCLI(['tool', 'read', 'package.json']);
  assert.equal(result.code, 0, 'should exit cleanly');
  assert.ok(result.stdout.includes('name') || result.stdout.includes('version'), 'should read package.json');
});

test('sicli profile --prompt works', async () => {
  const result = await runCLI(['profile', '--prompt']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli self-improve status works', async () => {
  const result = await runCLI(['self-improve', 'status']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

// Note: 'permissions' command doesn't exist in current CLI
// Permission mode is managed via config, not a separate command

test('sicli mcp list works', async () => {
  const result = await runCLI(['mcp', 'list']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli skills list works', async () => {
  const result = await runCLI(['skills', 'list']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('sicli config path works', async () => {
  const result = await runCLI(['config', 'path']);
  assert.equal(result.code, 0, 'should exit cleanly');
  assert.ok(result.stdout.includes('.selfimprove') || result.stdout.includes('config'), 'should show config path');
});

test('sicli config validate works', async () => {
  const result = await runCLI(['config', 'validate']);
  assert.equal(result.code, 0, 'should exit cleanly');
});

test('invalid command shows error', async () => {
  const result = await runCLI(['invalid-command']);
  assert.notEqual(result.code, 0, 'should fail for invalid command');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { loadConfig, setConfigValue, normalizeConfig, listProviderPresets, connectProvider, modelsForConfig, setModel, listPermissionModes, setPermissionMode } = require('../src/config');
const { writeFileTool, editFileTool } = require('../src/tools');
const { joinUrl, apiKeyFromConfig } = require('../src/provider');
const { setProviderApiKey, getProviderApiKey, secretStatus } = require('../src/secrets');
const { isGitReversibleFileAction } = require('../src/agent');
const { stripThinkBlocks } = require('../src/text-utils');

test('loadConfig creates default config without secret value', async () => {
  const root = await tempRoot();
  const config = await loadConfig(root);
  assert.equal(config.provider, 'openai-compatible');
  assert.equal(config.api_key_env, 'OPENAI_API_KEY');
  assert.equal(Object.hasOwn(config, 'api_key'), false);
});

test('provider presets include MiniMax and Z.AI coding plans', () => {
  const providers = listProviderPresets();
  assert.equal(providers.some((provider) => provider.id === 'minimax' && provider.base_url === 'https://api.minimax.io/v1'), true);
  assert.equal(providers.some((provider) => provider.id === 'zai' && provider.base_url === 'https://api.z.ai/api/coding/paas/v4'), true);
});

test('connectProvider selects MiniMax without storing secret', async () => {
  const root = await tempRoot();
  const config = await connectProvider(root, 'minimax');
  assert.equal(config.provider_label, 'MiniMax Coding Plan');
  assert.equal(config.api_key_env, 'MINIMAX_API_KEY');
  assert.equal(config.model, 'MiniMax-M2.7');
  assert.equal(Object.hasOwn(config, 'api_key'), false);
});

test('connectProvider selects Z.AI by number and setModel updates model', async () => {
  const root = await tempRoot();
  const config = await connectProvider(root, '3');
  assert.equal(config.provider_label, 'Z.AI Coding Plan');
  assert.deepEqual(modelsForConfig(config), ['GLM-5.1', 'GLM-5', 'GLM-5-Turbo', 'GLM-4.7', 'GLM-4.5-air']);
  const next = await setModel(root, 'GLM-5-Turbo');
  assert.equal(next.model, 'GLM-5-Turbo');
});

test('local provider secret stores key outside config', async () => {
  const root = await tempRoot();
  const config = await connectProvider(root, 'minimax');
  await setProviderApiKey(root, config.provider_id, 'sk-test-secret');
  assert.equal(await getProviderApiKey(root, 'minimax'), 'sk-test-secret');
  assert.deepEqual(await secretStatus(root, config), {
    provider_id: 'minimax',
    stored_api_key: true,
    secrets_file: path.join(root, '.selfimprove', 'secrets.json')
  });
  const reloaded = await loadConfig(root);
  assert.equal(Object.hasOwn(reloaded, 'api_key'), false);
});

test('apiKeyFromConfig prefers stored secret over env fallback', async () => {
  const root = await tempRoot();
  const config = await connectProvider(root, 'zai');
  await setProviderApiKey(root, config.provider_id, 'stored-key');
  assert.equal(await apiKeyFromConfig(root, config, { ZAI_API_KEY: 'env-key' }), 'stored-key');
});

test('apiKeyFromConfig falls back to configured env var', async () => {
  const root = await tempRoot();
  const config = await connectProvider(root, 'zai');
  assert.equal(await apiKeyFromConfig(root, config, { ZAI_API_KEY: 'env-key' }), 'env-key');
});

test('permission modes are listed, validated, and persisted', async () => {
  const root = await tempRoot();
  assert.equal(listPermissionModes().length, 4);
  let config = await loadConfig(root);
  assert.equal(config.permission_mode, 'partial_secure');
  config = await setPermissionMode(root, 'secure');
  assert.equal(config.permission_mode, 'secure');
  assert.throws(() => normalizeConfig({ permission_mode: 'bad' }), /permission_mode/);
  await assert.rejects(() => setPermissionMode(root, 'bad'), /permission mode/);
});

test('setConfigValue persists typed config values', async () => {
  const root = await tempRoot();
  await setConfigValue(root, 'model', 'test-model');
  await setConfigValue(root, 'temperature', '0.7');
  const config = await loadConfig(root);
  assert.equal(config.model, 'test-model');
  assert.equal(config.temperature, 0.7);
});

test('normalizeConfig rejects invalid max_tool_turns', () => {
  assert.throws(() => normalizeConfig({ max_tool_turns: 0 }), /max_tool_turns/);
});

test('joinUrl handles slashes', () => {
  assert.equal(joinUrl('https://example.test/v1/', '/chat/completions'), 'https://example.test/v1/chat/completions');
});

test('writeFileTool creates text file and blocks path escape', async () => {
  const root = await tempRoot();
  const result = await writeFileTool(root, 'hello.md', '# Hello\n');
  assert.equal(result.path, 'hello.md');
  assert.equal(await fs.readFile(path.join(root, 'hello.md'), 'utf8'), '# Hello\n');
  await assert.rejects(() => writeFileTool(root, '../escape.md', 'x'), /escapes workspace/);
});

test('writeFileTool respects overwrite false', async () => {
  const root = await tempRoot();
  await writeFileTool(root, 'hello.md', 'first');
  await assert.rejects(() => writeFileTool(root, 'hello.md', 'second', { overwrite: false }), /overwrite is false/);
});

test('git reversibility allows new write in git repo and rejects non-git', async () => {
  const root = await tempRoot();
  assert.equal(await isGitReversibleFileAction(root, 'write_file', { path: 'new.md' }), false);
  await run('git', ['init'], root);
  assert.equal(await isGitReversibleFileAction(root, 'write_file', { path: 'new.md' }), true);
});

test('stripThinkBlocks removes model reasoning blocks', () => {
  assert.equal(stripThinkBlocks('<think>hidden</think>\nHello!'), 'Hello!');
});

test('editFileTool replaces exact unique text', async () => {
  const root = await tempRoot();
  await fs.writeFile(path.join(root, 'a.txt'), 'hello old world', 'utf8');
  const result = await editFileTool(root, 'a.txt', 'old', 'new');
  assert.equal(result.path, 'a.txt');
  assert.equal(await fs.readFile(path.join(root, 'a.txt'), 'utf8'), 'hello new world');
});

test('editFileTool rejects duplicate old_text', async () => {
  const root = await tempRoot();
  await fs.writeFile(path.join(root, 'a.txt'), 'x old y old z', 'utf8');
  await assert.rejects(() => editFileTool(root, 'a.txt', 'old', 'new'), /not unique/);
});

async function tempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
}

function run(command, args, cwd) {
  const { spawn } = require('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

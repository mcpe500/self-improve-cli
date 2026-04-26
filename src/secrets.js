'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { statePath, initWorkspace } = require('./state');

const SECRETS_FILE = 'secrets.json';

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function secureStateDir(root) {
  await initWorkspace(root);
  const dir = statePath(root);
  try {
    await fs.chmod(dir, 0o700);
  } catch {
    // Best effort on Windows and restricted filesystems.
  }
  return dir;
}

async function loadSecrets(root = process.cwd()) {
  await secureStateDir(root);
  const file = statePath(root, SECRETS_FILE);
  if (!(await exists(file))) return { providers: {} };
  const secrets = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!secrets.providers || typeof secrets.providers !== 'object') secrets.providers = {};
  return secrets;
}

async function saveSecrets(root, secrets) {
  await secureStateDir(root);
  const file = statePath(root, SECRETS_FILE);
  const normalized = {
    providers: secrets.providers || {}
  };
  await fs.writeFile(file, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  try {
    await fs.chmod(file, 0o600);
  } catch {
    // Best effort on Windows and restricted filesystems.
  }
  return normalized;
}

function normalizeProviderId(providerId) {
  const id = String(providerId || '').trim();
  if (!id) throw new Error('provider_id required for secret storage');
  return id;
}

async function setProviderApiKey(root, providerId, apiKey) {
  const id = normalizeProviderId(providerId);
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('API key cannot be empty');
  const secrets = await loadSecrets(root);
  secrets.providers[id] = {
    api_key: key,
    updated_at: new Date().toISOString()
  };
  await saveSecrets(root, secrets);
  return { provider_id: id, stored: true, path: statePath(root, SECRETS_FILE) };
}

async function getProviderApiKey(root, providerId) {
  const id = normalizeProviderId(providerId);
  const secrets = await loadSecrets(root);
  return secrets.providers[id]?.api_key || '';
}

async function hasProviderApiKey(root, providerId) {
  return Boolean(await getProviderApiKey(root, providerId));
}

async function secretStatus(root, config) {
  return {
    provider_id: config.provider_id,
    stored_api_key: await hasProviderApiKey(root, config.provider_id),
    secrets_file: statePath(root, SECRETS_FILE)
  };
}

module.exports = {
  SECRETS_FILE,
  loadSecrets,
  saveSecrets,
  setProviderApiKey,
  getProviderApiKey,
  hasProviderApiKey,
  secretStatus
};

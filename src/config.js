'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { statePath, initWorkspace } = require('./state');
const { getGlobalConfigPath, getLocalConfigPath, ensureGlobalConfigDir, ensureLocalConfigDir } = require('./config-paths');
const { migrateLegacyConfig, listBuiltInProviders, getBuiltInProvider, createCustomProvider } = require('./provider-registry');
const { getDefaultSuperpowers, validateSuperpowers } = require('./superpowers');

const CONFIG_FILE = 'config.json';
const PERMISSION_MODES = new Set(['secure', 'partial_secure', 'ai_reviewed', 'auto_approve']);

const PROVIDER_PRESETS = {
  openai: {
    id: 'openai',
    label: 'OpenAI Compatible',
    provider: 'openai-compatible',
    base_url: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1']
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax Coding Plan',
    provider: 'openai-compatible',
    base_url: 'https://api.minimax.io/v1',
    api_key_env: 'MINIMAX_API_KEY',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed']
  },
  zai: {
    id: 'zai',
    label: 'Z.AI Coding Plan',
    provider: 'openai-compatible',
    base_url: 'https://api.z.ai/api/coding/paas/v4',
    api_key_env: 'ZAI_API_KEY',
    models: ['GLM-5.1', 'GLM-5', 'GLM-5-Turbo', 'GLM-4.7', 'GLM-4.5-air']
  },
  custom: {
    id: 'custom',
    label: 'Custom OpenAI Compatible',
    provider: 'openai-compatible',
    base_url: 'https://api.example.com/v1',
    api_key_env: 'CUSTOM_API_KEY',
    models: ['custom-model']
  }
};

function defaultConfig(env = process.env) {
  return {
    active_provider: env.SICLI_PROVIDER || 'openai',
    active_model: env.SICLI_MODEL || 'gpt-4.1-mini',
    providers: {},
    permission_mode: env.SICLI_PERMISSION_MODE || 'partial_secure',
    temperature: 0.2,
    max_tool_turns: 8,
    max_tool_turns_autonomous: 50,
    max_history_messages: 20,
    self_improve_background: true,
    self_improve_review_every: 1,
    ask_gate_enabled: false,
    superpowers: getDefaultSuperpowers(),
  };
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback) {
  if (!(await exists(file))) return fallback;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeConfig(config) {
  // Migrate legacy config if needed
  const { config: migrated, migrated: wasMigrated } = migrateLegacyConfig(config || {});
  const merged = { ...defaultConfig(), ...migrated };

  // Validate new format
  if (typeof merged.active_provider !== 'string') throw new Error('config.active_provider must be string');
  if (typeof merged.active_model !== 'string' || !merged.active_model) throw new Error('config.active_model must be non-empty string');
  if (typeof merged.providers !== 'object') throw new Error('config.providers must be object');
  if (!PERMISSION_MODES.has(merged.permission_mode)) throw new Error(`config.permission_mode must be one of ${Array.from(PERMISSION_MODES).join(', ')}`);
  if (typeof merged.temperature !== 'number') throw new Error('config.temperature must be number');
  if (!Number.isInteger(merged.max_tool_turns) || merged.max_tool_turns < 1) throw new Error('config.max_tool_turns must be positive integer');
  if (!Number.isInteger(merged.max_tool_turns_autonomous) || merged.max_tool_turns_autonomous < 1) throw new Error('config.max_tool_turns_autonomous must be positive integer');
  if (!Number.isInteger(merged.max_history_messages) || merged.max_history_messages < 1) throw new Error('config.max_history_messages must be positive integer');
  if (typeof merged.self_improve_background !== 'boolean') throw new Error('config.self_improve_background must be boolean');
  if (!Number.isInteger(merged.self_improve_review_every) || merged.self_improve_review_every < 1) throw new Error('config.self_improve_review_every must be positive integer');
  if (typeof merged.ask_gate_enabled !== 'boolean') throw new Error('config.ask_gate_enabled must be boolean');

  // Validate superpowers
  const spValidation = validateSuperpowers(merged.superpowers);
  if (!spValidation.valid) throw new Error(`Invalid superpowers: ${spValidation.errors.join(', ')}`);

  return { config: merged, migrated: wasMigrated };
}

/**
 * Load layered config: CLI flags > local > global > env > defaults
 * @param {string} root - workspace root
 * @param {object} options - { scope: 'local'|'global'|'merged', skipMigration: boolean }
 */
async function loadConfig(root = process.cwd(), options = {}) {
  const { scope = 'merged', skipMigration = false } = options;
  await initWorkspace(root);

  let localConfig = {};
  let globalConfig = {};

  // Load global config
  if (scope === 'global' || scope === 'merged') {
    const globalPath = getGlobalConfigPath();
    if (await exists(globalPath)) {
      globalConfig = await readJson(globalPath, {});
    }
  }

  // Load local config
  if (scope === 'local' || scope === 'merged') {
    const localPath = getLocalConfigPath(root);
    if (await exists(localPath)) {
      localConfig = await readJson(localPath, {});
    }
  }

  // Merge: local overrides global
  const rawConfig = scope === 'global' ? globalConfig : scope === 'local' ? localConfig : { ...globalConfig, ...localConfig };

  // Normalize and migrate
  const { config, migrated } = normalizeConfig(rawConfig);

  // Auto-save migration if needed
  if (migrated && !skipMigration) {
    if (scope === 'global' || (scope === 'merged' && Object.keys(localConfig).length === 0)) {
      await saveConfig(root, config, { scope: 'global', backup: true });
    } else {
      await saveConfig(root, config, { scope: 'local', backup: true });
    }
  }

  return config;
}

/**
 * Save config to local or global scope
 * @param {string} root - workspace root
 * @param {object} config - config object
 * @param {object} options - { scope: 'local'|'global', backup: boolean }
 */
async function saveConfig(root, config, options = {}) {
  const { scope = 'local', backup = false } = options;
  const { config: normalized } = normalizeConfig(config);

  let targetPath;
  if (scope === 'global') {
    await ensureGlobalConfigDir();
    targetPath = getGlobalConfigPath();
  } else {
    await ensureLocalConfigDir(root);
    targetPath = getLocalConfigPath(root);
  }

  // Backup if requested
  if (backup && (await exists(targetPath))) {
    const backupPath = `${targetPath}.bak`;
    await fs.copyFile(targetPath, backupPath);
  }

  await writeJson(targetPath, normalized);
  return normalized;
}

function parseConfigValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(String(value))) return Number(value);
  return value;
}

async function setConfigValue(root, key, value) {
  if (!key) throw new Error('config key required');
  const config = await loadConfig(root);
  config[key] = parseConfigValue(value);
  return saveConfig(root, config);
}

function listProviderPresets() {
  return Object.values(PROVIDER_PRESETS).map((preset) => ({
    id: preset.id,
    label: preset.label,
    provider: preset.provider,
    base_url: preset.base_url,
    api_key_env: preset.api_key_env,
    models: [...preset.models]
  }));
}

function findProviderPreset(value) {
  const query = String(value || '').trim().toLowerCase();
  if (!query) return null;
  const providers = listProviderPresets();
  if (/^\d+$/.test(query)) return providers[Number(query) - 1] || null;
  return providers.find((preset) => preset.id === query || preset.label.toLowerCase() === query || preset.label.toLowerCase().includes(query)) || null;
}

async function connectProvider(root, providerRef, options = {}) {
  const builtIn = getBuiltInProvider(providerRef);
  if (!builtIn) throw new Error(`Unknown provider: ${providerRef}`);
  const current = await loadConfig(root);
  const providers = { ...current.providers };
  providers[providerRef] = { ...builtIn };
  return saveConfig(root, {
    ...current,
    active_provider: providerRef,
    active_model: builtIn.default_model,
    providers,
  }, options);
}

async function connectCustomProvider(root, { id, base_url, model, models, api_key_env, label, local }, saveOptions = {}) {
  if (!id || !base_url) throw new Error('id and base_url required for custom provider');
  const provider = createCustomProvider({ id, label, base_url, api_key_env, models, default_model: model, local });
  const current = await loadConfig(root);
  const providers = { ...current.providers };
  providers[id] = provider;
  return saveConfig(root, {
    ...current,
    active_provider: id,
    active_model: provider.default_model,
    providers,
  }, saveOptions);
}

function modelsForConfig(config) {
  const providerId = config.active_provider || config.provider_id;
  const provider = config.providers?.[providerId] || getBuiltInProvider(providerId);
  if (provider?.models) return [...provider.models];
  // Fallback for legacy
  const preset = PROVIDER_PRESETS[providerId];
  if (preset) return [...preset.models];
  return [config.active_model || config.model].filter(Boolean);
}

async function setModel(root, model, options = {}) {
  if (!model) throw new Error('model required');
  const config = await loadConfig(root);
  return saveConfig(root, { ...config, active_model: model }, options);
}

function listPermissionModes() {
  return [
    { id: 'secure', label: 'Secure: ask before every tool call' },
    { id: 'partial_secure', label: 'Partial secure: allow read/search and git-reversible file actions; ask otherwise' },
    { id: 'ai_reviewed', label: 'AI reviewed: reviewer model approves action tools; ask on deny/error' },
    { id: 'auto_approve', label: 'Auto approve: allow all profile-permitted tools' }
  ];
}

async function setPermissionMode(root, mode) {
  if (!PERMISSION_MODES.has(mode)) throw new Error(`permission mode must be one of ${Array.from(PERMISSION_MODES).join(', ')}`);
  const config = await loadConfig(root);
  return saveConfig(root, { ...config, permission_mode: mode });
}

async function removeProvider(root, providerId, options = {}) {
  const config = await loadConfig(root);
  if (config.active_provider === providerId) {
    throw new Error('Cannot remove active provider. Switch to another provider first.');
  }
  const providers = { ...config.providers };
  delete providers[providerId];
  return saveConfig(root, { ...config, providers }, options);
}

async function listProviders(root) {
  const config = await loadConfig(root);
  const configured = Object.keys(config.providers || {}).map(id => ({
    id,
    ...config.providers[id],
    configured: true,
    active: id === config.active_provider,
  }));
  const builtIn = listBuiltInProviders().map(p => ({
    ...p,
    configured: !!config.providers?.[p.id],
    active: p.id === config.active_provider,
  }));
  // Merge, prefer configured
  const merged = new Map();
  for (const p of builtIn) merged.set(p.id, p);
  for (const p of configured) merged.set(p.id, p);
  return Array.from(merged.values());
}

module.exports = {
  CONFIG_FILE,
  PERMISSION_MODES,
  PROVIDER_PRESETS,
  defaultConfig,
  normalizeConfig,
  loadConfig,
  saveConfig,
  setConfigValue,
  listPermissionModes,
  setPermissionMode,
  listProviderPresets,
  findProviderPreset,
  connectProvider,
  connectCustomProvider,
  modelsForConfig,
  setModel,
  removeProvider,
  listProviders,
};


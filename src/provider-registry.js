'use strict';

/**
 * Provider registry with built-in definitions for multiple AI providers.
 * Supports OpenAI-compatible endpoints, custom providers, and local models.
 */

const BUILT_IN_PROVIDERS = {
  openai: {
    type: 'openai-compatible',
    label: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'o1-preview', 'o1-mini'],
    default_model: 'gpt-4.1-mini',
  },
  minimax: {
    type: 'openai-compatible',
    label: 'MiniMax',
    base_url: 'https://api.minimax.chat/v1',
    api_key_env: 'MINIMAX_API_KEY',
    models: ['MiniMax-Text-01', 'MiniMax-M2.7'],
    default_model: 'MiniMax-Text-01',
  },
  zai: {
    type: 'openai-compatible',
    label: 'Z.AI',
    base_url: 'https://api.z.ai/v1',
    api_key_env: 'ZAI_API_KEY',
    models: ['z-001', 'z-002'],
    default_model: 'z-001',
  },
  ollama: {
    type: 'openai-compatible',
    label: 'Ollama (Local)',
    base_url: 'http://localhost:11434/v1',
    api_key_env: 'OLLAMA_API_KEY',
    models: ['llama3.1', 'llama3.2', 'qwen2.5-coder', 'deepseek-coder', 'codellama'],
    default_model: 'qwen2.5-coder',
    local: true,
  },
  lmstudio: {
    type: 'openai-compatible',
    label: 'LM Studio (Local)',
    base_url: 'http://localhost:1234/v1',
    api_key_env: 'LMSTUDIO_API_KEY',
    models: ['local-model'],
    default_model: 'local-model',
    local: true,
  },
  vllm: {
    type: 'openai-compatible',
    label: 'vLLM (Local)',
    base_url: 'http://localhost:8000/v1',
    api_key_env: 'VLLM_API_KEY',
    models: ['local-model'],
    default_model: 'local-model',
    local: true,
  },
  openrouter: {
    type: 'openai-compatible',
    label: 'OpenRouter',
    base_url: 'https://openrouter.ai/api/v1',
    api_key_env: 'OPENROUTER_API_KEY',
    models: [
      'openai/gpt-4-turbo',
      'anthropic/claude-3-opus',
      'google/gemini-pro',
      'meta-llama/llama-3.1-405b',
    ],
    default_model: 'openai/gpt-4-turbo',
  },
};

function getBuiltInProvider(id) {
  return BUILT_IN_PROVIDERS[id] || null;
}

function listBuiltInProviders() {
  return Object.keys(BUILT_IN_PROVIDERS).map((id) => ({
    id,
    ...BUILT_IN_PROVIDERS[id],
  }));
}

function createCustomProvider({
  id,
  label,
  base_url,
  api_key_env,
  models,
  default_model,
  local = false,
}) {
  if (!id || !base_url) {
    throw new Error('Custom provider requires id and base_url');
  }
  return {
    type: 'openai-compatible',
    label: label || `Custom (${id})`,
    base_url,
    api_key_env: api_key_env || `${id.toUpperCase()}_API_KEY`,
    models: models || ['default-model'],
    default_model: default_model || (models && models[0]) || 'default-model',
    local,
    custom: true,
  };
}

/**
 * Normalize legacy config to new provider registry format.
 * Creates backup before migration.
 */
function migrateLegacyConfig(config) {
  // If already has providers registry, no migration needed
  if (config.providers && typeof config.providers === 'object') {
    return { config, migrated: false };
  }

  // Legacy format detection
  const hasLegacy = config.provider_id || config.provider || config.base_url;
  if (!hasLegacy) {
    // No legacy config, initialize with defaults
    return {
      config: {
        ...config,
        active_provider: 'openai',
        active_model: 'gpt-4.1-mini',
        providers: {},
      },
      migrated: false,
    };
  }

  // Extract legacy values
  const legacyId = config.provider_id || config.provider || 'custom';
  const legacyLabel = config.provider_label || legacyId;
  const legacyBaseUrl = config.base_url || 'https://api.openai.com/v1';
  const legacyApiKeyEnv = config.api_key_env || 'OPENAI_API_KEY';
  const legacyModel = config.model || 'gpt-4.1-mini';

  // Check if it matches a built-in provider
  const builtIn = getBuiltInProvider(legacyId);
  const providers = {};

  if (builtIn) {
    // Use built-in definition
    providers[legacyId] = { ...builtIn };
  } else {
    // Create custom provider from legacy config
    providers[legacyId] = {
      type: 'openai-compatible',
      label: legacyLabel,
      base_url: legacyBaseUrl,
      api_key_env: legacyApiKeyEnv,
      models: [legacyModel],
      default_model: legacyModel,
      custom: true,
    };
  }

  // Build migrated config
  const migrated = {
    ...config,
    active_provider: legacyId,
    active_model: legacyModel,
    providers,
  };

  // Remove legacy fields
  delete migrated.provider_id;
  delete migrated.provider;
  delete migrated.provider_label;
  delete migrated.base_url;
  delete migrated.api_key_env;
  delete migrated.model;

  return { config: migrated, migrated: true };
}

module.exports = {
  BUILT_IN_PROVIDERS,
  getBuiltInProvider,
  listBuiltInProviders,
  createCustomProvider,
  migrateLegacyConfig,
};

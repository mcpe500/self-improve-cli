'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getBuiltInProvider, listBuiltInProviders, createCustomProvider, migrateLegacyConfig } = require('../src/provider-registry');

test('getBuiltInProvider returns openai provider', () => {
  const provider = getBuiltInProvider('openai');
  assert.equal(provider.type, 'openai-compatible');
  assert.equal(provider.label, 'OpenAI');
  assert.equal(provider.base_url, 'https://api.openai.com/v1');
  assert.ok(provider.models.includes('gpt-4.1-mini'));
});

test('getBuiltInProvider returns null for unknown', () => {
  assert.equal(getBuiltInProvider('unknown'), null);
});

test('listBuiltInProviders includes common providers', () => {
  const providers = listBuiltInProviders();
  assert.ok(providers.length >= 6);
  assert.ok(providers.some(p => p.id === 'openai'));
  assert.ok(providers.some(p => p.id === 'ollama'));
  assert.ok(providers.some(p => p.id === 'minimax'));
});

test('createCustomProvider validates required fields', () => {
  assert.throws(() => createCustomProvider({}), /id and base_url/);
  assert.throws(() => createCustomProvider({ id: 'test' }), /id and base_url/);
});

test('createCustomProvider creates valid provider', () => {
  const provider = createCustomProvider({
    id: 'custom',
    base_url: 'https://api.example.com/v1',
    models: ['model-a', 'model-b'],
  });
  assert.equal(provider.type, 'openai-compatible');
  assert.equal(provider.base_url, 'https://api.example.com/v1');
  assert.equal(provider.default_model, 'model-a');
  assert.equal(provider.custom, true);
});

test('migrateLegacyConfig handles no legacy config', () => {
  const { config, migrated } = migrateLegacyConfig({});
  assert.equal(migrated, false);
  assert.equal(config.active_provider, 'openai');
  assert.equal(typeof config.providers, 'object');
});

test('migrateLegacyConfig converts old format to new', () => {
  const legacy = {
    provider_id: 'minimax',
    provider_label: 'MiniMax',
    provider: 'openai-compatible',
    base_url: 'https://api.minimax.chat/v1',
    api_key_env: 'MINIMAX_API_KEY',
    model: 'MiniMax-M2.7',
  };
  const { config, migrated } = migrateLegacyConfig(legacy);
  assert.equal(migrated, true);
  assert.equal(config.active_provider, 'minimax');
  assert.equal(config.active_model, 'MiniMax-M2.7');
  assert.ok(config.providers.minimax);
  assert.equal(config.providers.minimax.base_url, 'https://api.minimax.chat/v1');
  assert.equal(config.provider_id, undefined);
  assert.equal(config.provider, undefined);
});

test('migrateLegacyConfig uses built-in when available', () => {
  const legacy = {
    provider_id: 'openai',
    base_url: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  };
  const { config, migrated } = migrateLegacyConfig(legacy);
  assert.equal(migrated, true);
  assert.equal(config.active_provider, 'openai');
  assert.ok(config.providers.openai);
  assert.equal(config.providers.openai.label, 'OpenAI');
});

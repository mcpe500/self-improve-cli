'use strict';

const { getProviderApiKey } = require('./secrets');
const { getBuiltInProvider } = require('./provider-registry');

function joinUrl(baseUrl, suffix) {
  return `${baseUrl.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

function anySignal(...signals) {
  const controller = new AbortController();
  for (const s of signals) {
    if (s) s.addEventListener('abort', () => controller.abort());
  }
  return controller.signal;
}

async function apiKeyFromConfig(root, config, env = process.env) {
  // New format
  const providerId = config.active_provider || config.provider_id;
  const provider = config.providers?.[providerId] || getBuiltInProvider(providerId);
  const apiKeyEnv = provider?.api_key_env || config.api_key_env;

  const stored = await getProviderApiKey(root, providerId);
  if (stored) return stored;
  const key = env[apiKeyEnv];
  if (key) return key;
  throw new Error(`Missing API key for ${provider?.label || providerId}. Run /connect or /key, or set env ${apiKeyEnv}.`);
}

async function chatCompletion(root, config, messages, tools = [], signal) {
  // Get provider config
  const providerId = config.active_provider || config.provider_id;
  const provider = config.providers?.[providerId] || getBuiltInProvider(providerId);
  const providerType = provider?.type || config.provider;
  const baseUrl = provider?.base_url || config.base_url;
  const model = config.active_model || config.model;

  if (providerType !== 'openai-compatible') throw new Error(`Unsupported provider: ${providerType}`);
  const timeoutMs = (config.timeout_ms) || 30000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal ? anySignal(signal, controller.signal) : controller.signal;
  const response = await fetch(joinUrl(baseUrl, 'chat/completions'), {
    signal: combinedSignal,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${await apiKeyFromConfig(root, config)}`
    },
    body: JSON.stringify({
      model,
      temperature: config.temperature,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined
    })
  });
  clearTimeout(timeout);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    const message = body.error?.message || body.message || response.statusText;
    throw new Error(`Provider error ${response.status}: ${message}`);
  }
  const message = body.choices?.[0]?.message;
  if (!message) throw new Error('Provider response missing choices[0].message');
  return { message, usage: body.usage || null };
}

module.exports = {
  joinUrl,
  apiKeyFromConfig,
  chatCompletion
};

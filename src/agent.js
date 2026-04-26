'use strict';

const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { compileProfilePrompt } = require('./profile');
const { loadProfiles } = require('./state');
const { loadConfig, listProviderPresets, connectProvider, modelsForConfig, setModel } = require('./config');
const { chatCompletion } = require('./provider');
const { setProviderApiKey, hasProviderApiKey, secretStatus } = require('./secrets');
const { readFileTool, searchTool, runCommandTool, editFileTool } = require('./tools');

const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 file from the workspace. Output is capped.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search workspace files for literal text. Heavy directories are skipped.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          dir: { type: 'string' }
        },
        required: ['pattern'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a command with args using shell=false. Use for tests and checks.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } }
        },
        required: ['command'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by replacing one exact, unique old_text block with new_text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_text: { type: 'string' },
          new_text: { type: 'string' }
        },
        required: ['path', 'old_text', 'new_text'],
        additionalProperties: false
      }
    }
  }
];

const TOOL_POLICY_KEYS = {
  read_file: 'read_file',
  search: 'search',
  run_command: 'run_command',
  edit_file: 'edit_file'
};

function compactJson(value, limit = 12000) {
  const text = JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...<truncated>` : text;
}

function systemPrompt(profile) {
  return `${compileProfilePrompt(profile)}\n\nAgent loop rules:\n- You are self-improve-cli, a lightweight coding agent.\n- Use tool calls when repository facts are needed.\n- Read relevant files before editing existing files.\n- For edits, use edit_file with exact unique old_text.\n- Keep final answers concise and include validation run when possible.\n- Do not claim a command passed unless run_command output proves it.`;
}

function parseToolArgs(toolCall) {
  const raw = toolCall.function?.arguments || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON tool args for ${toolCall.function?.name || 'unknown'}: ${raw}`);
  }
}

async function askApproval(question) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function ensureAllowed(profile, name, args, options) {
  const policyKey = TOOL_POLICY_KEYS[name];
  const policy = profile.tool_policy[policyKey] || 'deny';
  if (policy === 'allow') return;
  if (policy === 'deny') throw new Error(`Tool denied by profile: ${name}`);
  if (policy === 'ask') {
    if (options.yes) return;
    if (!options.interactive) throw new Error(`Tool requires approval: ${name}. Re-run with --yes or use interactive chat.`);
    const ok = await askApproval(`Allow ${name} ${compactJson(args, 500)}?`);
    if (!ok) throw new Error(`Tool not approved: ${name}`);
    return;
  }
  throw new Error(`Unknown tool policy for ${name}: ${policy}`);
}

async function executeTool(root, profile, toolCall, options) {
  const name = toolCall.function?.name;
  const args = parseToolArgs(toolCall);
  await ensureAllowed(profile, name, args, options);
  if (options.trace) process.stderr.write(`tool ${name} ${compactJson(args, 800)}\n`);
  if (name === 'read_file') return readFileTool(root, args.path);
  if (name === 'search') return searchTool(root, args.pattern, args.dir || '.');
  if (name === 'run_command') return runCommandTool(root, args.command, args.args || []);
  if (name === 'edit_file') return editFileTool(root, args.path, args.old_text, args.new_text);
  throw new Error(`Unknown tool: ${name || '(missing)'}`);
}

function trimHistory(messages, maxHistoryMessages) {
  const system = messages[0];
  const rest = messages.slice(1);
  return [system, ...rest.slice(-maxHistoryMessages)];
}

async function runAgentTask(root, prompt, options = {}) {
  const { active } = await loadProfiles(root);
  const config = await loadConfig(root);
  const messages = [
    { role: 'system', content: systemPrompt(active) },
    ...(options.history || []),
    { role: 'user', content: prompt }
  ];
  const maxTurns = options.maxTurns || config.max_tool_turns;
  for (let turn = 0; turn < maxTurns; turn += 1) {
    const requestMessages = trimHistory(messages, config.max_history_messages + 1);
    const assistant = await chatCompletion(root, config, requestMessages, TOOL_SCHEMAS);
    messages.push(assistant);
    const toolCalls = assistant.tool_calls || [];
    if (!toolCalls.length) return { text: assistant.content || '', messages };
    for (const toolCall of toolCalls) {
      let result;
      try {
        result = { ok: true, result: await executeTool(root, active, toolCall, options) };
      } catch (error) {
        result = { ok: false, error: error.message };
      }
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: compactJson(result)
      });
    }
  }
  return { text: `Stopped after max tool turns (${maxTurns}).`, messages };
}

async function printProviderHelp(root, config) {
  const status = await secretStatus(root, config);
  process.stdout.write(`Connected: ${config.provider_label}\n`);
  process.stdout.write(`Base URL: ${config.base_url}\n`);
  process.stdout.write(`Model: ${config.model}\n`);
  process.stdout.write(`Stored API key: ${status.stored_api_key ? 'yes' : 'no'}\n`);
  process.stdout.write(`Secret file: ${status.secrets_file}\n`);
  process.stdout.write(`Env fallback: ${config.api_key_env}\n`);
}

async function askHidden(question, rl) {
  if (!input.isTTY || !input.setRawMode) {
    process.stdout.write('Warning: terminal cannot hide input; key may be visible.\n');
    try {
      return (await rl.question(question)).trim();
    } catch (error) {
      if (error.message === 'readline was closed') return '';
      throw error;
    }
  }
  rl.pause();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      rl.resume();
    };
    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const char of text) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Cancelled'));
          return;
        }
        if (char === '\r' || char === '\n') {
          output.write('\n');
          cleanup();
          resolve(value.trim());
          return;
        }
        if (char === '\b' || char === '\u007f') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function promptAndStoreApiKey(root, config, rl) {
  const existing = await hasProviderApiKey(root, config.provider_id);
  const suffix = existing ? 'replace stored key, empty to keep existing' : 'empty to skip';
  const key = await askHidden(`API key for ${config.provider_label} (${suffix}): `, rl);
  if (!key) {
    process.stdout.write(existing ? 'Stored API key unchanged.\n' : 'No API key stored. Use /key later.\n');
    return false;
  }
  const result = await setProviderApiKey(root, config.provider_id, key);
  process.stdout.write(`Stored API key securely in ${result.path}\n`);
  return true;
}

function listProviders() {
  const providers = listProviderPresets();
  process.stdout.write('Providers:\n');
  providers.forEach((provider, index) => {
    process.stdout.write(`  ${index + 1}. ${provider.id} - ${provider.label} (${provider.base_url})\n`);
  });
  return providers;
}

async function handleConnectCommand(root, arg, rl) {
  let selection = arg;
  if (!selection) {
    listProviders();
    selection = (await rl.question('provider> ')).trim();
  }
  const config = await connectProvider(root, selection);
  await printProviderHelp(root, config);
  await promptAndStoreApiKey(root, config, rl);
  return true;
}

async function handleModelsCommand(root, arg, rl) {
  const config = await loadConfig(root);
  const models = modelsForConfig(config);
  if (!models.length) {
    process.stdout.write(`No model preset for ${config.provider_label}. Use /models <model>.\n`);
    return true;
  }
  let selection = arg;
  process.stdout.write(`Models for ${config.provider_label}:\n`);
  models.forEach((model, index) => {
    const active = model === config.model ? ' *' : '';
    process.stdout.write(`  ${index + 1}. ${model}${active}\n`);
  });
  if (!selection) selection = (await rl.question('model> ')).trim();
  if (!selection) return true;
  const model = /^\d+$/.test(selection) ? models[Number(selection) - 1] : selection;
  if (!model) throw new Error(`Unknown model selection: ${selection}`);
  const next = await setModel(root, model);
  process.stdout.write(`Model: ${next.model}\n`);
  return true;
}

async function handleSlashCommand(root, prompt, rl) {
  const [command, ...parts] = prompt.split(/\s+/);
  const arg = parts.join(' ').trim();
  if (command === '/exit' || command === '/quit') return false;
  if (command === '/help') {
    process.stdout.write('Commands: /connect [provider], /key, /models [model], /config, /help, /exit\n');
    return true;
  }
  if (command === '/config') {
    const config = await loadConfig(root);
    process.stdout.write(`${JSON.stringify({ ...config, ...(await secretStatus(root, config)) }, null, 2)}\n`);
    return true;
  }
  if (command === '/key') {
    const config = await loadConfig(root);
    await promptAndStoreApiKey(root, config, rl);
    return true;
  }
  if (command === '/connect') return handleConnectCommand(root, arg, rl);
  if (command === '/models') return handleModelsCommand(root, arg, rl);
  process.stdout.write(`Unknown command: ${command}. Use /help.\n`);
  return true;
}

async function startChat(root, options = {}) {
  const rl = readline.createInterface({ input, output });
  const history = [];
  process.stdout.write('self-improve-cli chat. /help for commands. /exit to quit.\n');
  try {
    while (true) {
      let prompt;
      try {
        prompt = (await rl.question('sicli> ')).trim();
      } catch (error) {
        if (error.message === 'readline was closed') break;
        throw error;
      }
      if (!prompt) continue;
      if (prompt.startsWith('/')) {
        try {
          const keepGoing = await handleSlashCommand(root, prompt, rl);
          if (!keepGoing) break;
        } catch (error) {
          process.stderr.write(`Error: ${error.message}\n`);
        }
        continue;
      }
      try {
        const result = await runAgentTask(root, prompt, { ...options, interactive: true, history });
        process.stdout.write(`${result.text}\n`);
        history.splice(0, history.length, ...result.messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.tool_calls)).slice(-10));
      } catch (error) {
        process.stderr.write(`Error: ${error.message}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

module.exports = {
  TOOL_SCHEMAS,
  systemPrompt,
  runAgentTask,
  handleSlashCommand,
  startChat
};

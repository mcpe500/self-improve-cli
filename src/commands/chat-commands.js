'use strict';

const readline = require('node:readline');
const rlPromises = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const { loadConfig, setConfigValue, listProviderPresets, connectProvider, modelsForConfig, setModel, listPermissionModes, setPermissionMode } = require('../config');
const { loadProfiles, loadMcpConfig, saveMcpConfig } = require('../state');
const { setProviderApiKey, hasProviderApiKey, secretStatus } = require('../secrets');
const { learnFromMessage, runDemo, runBackgroundReview, getSelfImproveStatus, setGrowthLevel } = require('../self-improve');
const { MCPManager } = require('../mcp-client');
const { discoverSkills, enableSkill, disableSkill } = require('../skills');
const { compactJson } = require('../text-utils');

async function askApproval(question, rl) {
  if (!rl) throw new Error('askApproval requires rl in interactive mode');
  const answer = await rl.question(`${question} [y/N] `);
  return /^y(es)?$/i.test(answer.trim());
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
  let nestedInputActive = false;
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      nestedInputActive = false;
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
    nestedInputActive = true;
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
  const prompted = !arg;
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
  if (prompted && !models.includes(model)) {
    process.stdout.write(`Invalid model selection: ${selection}. Pick a number, or use /models <custom-model>.\n`);
    return true;
  }
  const next = await setModel(root, model);
  process.stdout.write(`Model: ${next.model}\n`);
  return true;
}

function printSelfImproveResult(result) {
  process.stdout.write(`Self-improve: ${result.audit.applied ? 'applied' : 'logged'}\n`);
  process.stdout.write(`Reason: ${result.suggestion.reason}\n`);
  process.stdout.write(`Gate: ${result.audit.gate.reason}\n`);
  process.stdout.write(`Patch ops: ${result.suggestion.patch.length}\n`);
}

async function handleSelfImproveCommand(root, arg) {
  const [action, ...parts] = String(arg || '').trim().split(/\s+/).filter(Boolean);
  if (!action || action === 'status') {
    process.stdout.write(`${JSON.stringify(await getSelfImproveStatus(root), null, 2)}\n`);
    return true;
  }
  if (action === 'demo') {
    printSelfImproveResult(await runDemo(root, { apply: parts.includes('--apply') }));
    return true;
  }
  if (action === 'enable') {
    await setGrowthLevel(root, 'medium', { auto_apply: true });
    await setConfigValue(root, 'self_improve_background', 'true');
    await setConfigValue(root, 'self_improve_review_every', '1');
    process.stdout.write('Self-improve enabled: background=true, review_every=1, growth=medium auto_apply=true\n');
    return true;
  }
  if (action === 'growth') {
    const level = parts[0];
    if (!level) throw new Error('usage: /self-improve growth <none|low|medium|high|very_high> [--auto-apply true|false]');
    const autoFlag = parts.includes('--auto-apply') ? parts[parts.indexOf('--auto-apply') + 1] : undefined;
    const result = await setGrowthLevel(root, level, autoFlag === undefined ? {} : { auto_apply: String(autoFlag) === 'true' });
    process.stdout.write(`Growth: ${JSON.stringify(result.active.growth)}\n`);
    return true;
  }
  if (action === 'background-run') {
    const result = await runBackgroundReview(root);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return true;
  }
  if (action === 'learn') {
    const apply = parts.includes('--apply');
    const message = parts.filter((part) => part !== '--apply').join(' ');
    if (!message) throw new Error('usage: /self-improve learn <message> [--apply]');
    printSelfImproveResult(await learnFromMessage(root, message, { apply, type: 'user_lesson' }));
    return true;
  }
  process.stdout.write('Usage: /self-improve [status|enable|growth <level> [--auto-apply true|false]|demo [--apply]|background-run|learn <message> [--apply]]\n');
  return true;
}

async function handlePermissionsCommand(root, arg) {
  if (!arg) {
    const config = await loadConfig(root);
    process.stdout.write(`Permission mode: ${config.permission_mode}\n`);
    process.stdout.write('Modes:\n');
    for (const mode of listPermissionModes()) process.stdout.write(`  ${mode.id} - ${mode.label}\n`);
    return true;
  }
  const config = await setPermissionMode(root, arg);
  process.stdout.write(`Permission mode: ${config.permission_mode}\n`);
  return true;
}

function formatSwarmFeatures(features) {
  const lines = ['\nPlanning... features found:'];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    lines.push(`  ${i + 1}. [${f.estimated_effort || 'medium'}] ${f.title}`);
    lines.push(`     ${f.description.slice(0, 120)}`);
    if (f.dependencies?.length) lines.push(`     depends: ${f.dependencies.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function handleSwarmCommand(root, prompt, rl) {
  if (!prompt.trim()) {
    process.stdout.write('usage: /swarm <prompt> [--yes]\n');
    return true;
  }
  const yes = /--yes\b/.test(prompt);
  const cleanPrompt = prompt.replace(/--yes\b/g, '').trim();

  process.stdout.write('Analyzing request...\n');
  const config = await loadConfig(root);
  const { planFeatures } = require('../orchestrator');

  try {
    const features = await planFeatures(root, config, cleanPrompt, { signal: null });
    process.stdout.write(formatSwarmFeatures(features));

    if (!yes && rl) {
      const ok = await askApproval('Execute all features?', rl);
      if (!ok) {
        process.stdout.write('Swarm cancelled.\n');
        return true;
      }
    }

    process.stdout.write('Executing swarm...\n');
    const output = await require('../orchestrator').runSwarm(root, cleanPrompt, {
      signal: null,
      interactive: true,
      yes,
      onProgress: (evt) => {
        if (evt.type === 'feature_start') {
          process.stdout.write(`  Starting: ${evt.feature.title}\n`);
        } else if (evt.type === 'feature_done') {
          const status = evt.result.status === 'completed' ? '✓' : '⚠';
          process.stdout.write(`  ${status} ${evt.feature.title}: ${evt.result.status}\n`);
        }
      }
    });

    const m = output.merged;
    process.stdout.write(`\nSwarm complete — ${m.summary}\n`);
    if (m.successful.length) {
      process.stdout.write('Successful:\n');
      for (const f of m.successful) {
        const files = f.workerResult?.touchedFiles || [];
        process.stdout.write(`  ✓ ${f.feature.title}`);
        if (files.length) process.stdout.write(` (${files.join(', ')})`);
        process.stdout.write('\n');
      }
    }
    if (m.failed.length) {
      process.stdout.write('Failed:\n');
      for (const f of m.failed) process.stdout.write(`  ✗ ${f.feature?.title || 'unknown'}: ${f.error || 'unknown error'}\n`);
    }
    process.stdout.write('\n');
  } catch (error) {
    process.stderr.write(`Swarm error: ${error.message}\n`);
  }
  return true;
}

async function handleMCPCommand(root, arg) {
  const [sub, ...rest] = arg.split(/\s+/);
  if (sub === 'add') {
    if (rest.length < 2) {
      process.stdout.write('Usage: /mcp add <name> <command> [args...] [--env KEY=VAL]\n');
      return true;
    }
    const name = rest[0];
    const command = rest[1];
    const mArgs = [];
    const env = {};
    let i = 2;
    while (i < rest.length) {
      if (rest[i] === '--env' && rest[i + 1]) {
        const eqIdx = rest[i + 1].indexOf('=');
        if (eqIdx > 0) env[rest[i + 1].slice(0, eqIdx)] = rest[i + 1].slice(eqIdx + 1);
        i += 2;
      } else {
        mArgs.push(rest[i]);
        i++;
      }
    }
    const config = await loadMcpConfig(root);
    if (config.mcpServers[name]) {
      process.stdout.write(`Server "${name}" already exists. Use /mcp remove first.\n`);
      return true;
    }
    config.mcpServers[name] = { command, args: mArgs, env };
    await saveMcpConfig(root, config);
    process.stdout.write(`Added "${name}". Reconnect with /mcp reload or restart chat.\n`);
    return true;
  }
  if (sub === 'remove') {
    const name = rest[0];
    if (!name) {
      process.stdout.write('Usage: /mcp remove <name>\n');
      return true;
    }
    const config = await loadMcpConfig(root);
    if (!config.mcpServers[name]) {
      process.stdout.write(`Server "${name}" not found.\n`);
      return true;
    }
    delete config.mcpServers[name];
    await saveMcpConfig(root, config);
    process.stdout.write(`Removed "${name}".\n`);
    return true;
  }
  if (sub === 'list') {
    const config = await loadMcpConfig(root);
    const servers = config.mcpServers || {};
    const names = Object.keys(servers);
    if (!names.length) {
      process.stdout.write('No MCP servers configured.\n');
      return true;
    }
    for (const name of names) {
      const sc = servers[name];
      const type = sc.url ? 'remote' : 'stdio';
      process.stdout.write(`  ${name} [${type}] ${sc.command || sc.url}\n`);
    }
    return true;
  }
  if (sub === 'reload') {
    const config = await loadMcpConfig(root);
    const servers = config.mcpServers || {};
    const names = Object.keys(servers);
    if (!names.length) {
      process.stdout.write('No MCP servers configured.\n');
      return true;
    }
    const { MCPManager } = require('../mcp-client');
    const manager = new MCPManager(root, config);
    try {
      await manager.discover();
      for (const name of names) {
        const status = manager.getStatus(name);
        if (status.connected) {
          process.stdout.write(`  + ${name} (${status.toolCount} tools)\n`);
        } else {
          process.stdout.write(`  x ${name} (not connected)\n`);
        }
      }
    } catch (err) {
      process.stdout.write(`Reload failed: ${err.message}\n`);
    } finally {
      await manager.shutdown().catch(() => {});
    }
    return true;
  }
  process.stdout.write('Usage: /mcp [add|remove|list|reload]\n');
  return true;
}

async function handleSkillsCommand(root, arg) {
  const [sub, ...rest] = arg.split(/\s+/);
  if (sub === 'list' || !sub) {
    const discovered = await discoverSkills(root);
    const { active } = await loadProfiles(root);
    const activeNames = active.memory?.active_skills || [];
    if (!discovered.length) {
      process.stdout.write('No skills found.\n');
      return true;
    }
    for (const skill of discovered) {
      const marker = activeNames.includes(skill.name) ? ' [ACTIVE]' : '';
      process.stdout.write(`  ${skill.name}${marker} — ${skill.description}\n`);
    }
    return true;
  }
  if (sub === 'enable') {
    const name = rest[0];
    if (!name) {
      process.stdout.write('Usage: /skills enable <name>\n');
      return true;
    }
    await enableSkill(root, name);
    process.stdout.write(`Skill "${name}" enabled. Takes effect on next task.\n`);
    return true;
  }
  if (sub === 'disable') {
    const name = rest[0];
    if (!name) {
      process.stdout.write('Usage: /skills disable <name>\n');
      return true;
    }
    await disableSkill(root, name);
    process.stdout.write(`Skill "${name}" disabled.\n`);
    return true;
  }
  process.stdout.write('Usage: /skills [list|enable|disable]\n');
  return true;
}

async function handleSlashCommand(root, prompt, rl) {
  const [command, ...parts] = prompt.split(/\s+/);
  const arg = parts.join(' ').trim();
  if (command === '/exit' || command === '/quit') return false;
  if (command === '/help') {
    process.stdout.write('Commands: /connect [provider], /key, /models [model], /permissions [mode], /self-improve [status|enable|growth|demo|learn], /swarm <prompt>, /mcp [add|remove|list|reload], /skills [list|enable|disable], /config, /help, /exit\n');
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
  if (command === '/permissions') return handlePermissionsCommand(root, arg);
  if (command === '/swarm') return handleSwarmCommand(root, arg, rl);
  if (command === '/self-improve') return handleSelfImproveCommand(root, arg);
  if (command === '/mcp') return handleMCPCommand(root, arg);
  if (command === '/skills') return handleSkillsCommand(root, arg);
  process.stdout.write(`Unknown command: ${command}. Use /help.\n`);
  return true;
}

async function startChat(root, options = {}, { runAgentTask } = {}) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  const rl = await rlPromises.createInterface({ input, output });
  const history = [];
  process.stdout.write('self-improve-cli chat. /help for commands. /exit to quit. Press ESC to cancel task.\n');
  
  let nestedInputActive = false;
  let currentController = null;
  const keypressHandler = (str, key) => {
    if (key && key.name === 'escape' && currentController && !nestedInputActive) {
      currentController.abort();
      process.stdout.write('\n[Cancelled]\n');
    }
  };
  process.stdin.on('keypress', keypressHandler);

  try {
    while (true) {
      let prompt;
      try {
        prompt = ((await rl.question('sicli> ')) || '').trim();
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
        currentController = new AbortController();
        const result = await runAgentTask(root, prompt, { ...options, interactive: true, history, rl, signal: currentController.signal });
        process.stdout.write(`${result.text}\n`);
        history.splice(0, history.length, ...result.messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.tool_calls)).slice(-10));
      } catch (error) {
        if (error.name === 'AbortError') process.stdout.write('\n[Task Aborted]\n');
        else process.stderr.write(`Error: ${error.message}\n`);
      } finally {
        currentController = null;
      }
    }
  } finally {
    process.stdin.removeListener('keypress', keypressHandler);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    rl.close();
  }
}

module.exports = {
  askApproval,
  printProviderHelp,
  askHidden,
  promptAndStoreApiKey,
  listProviders,
  handleConnectCommand,
  handleModelsCommand,
  printSelfImproveResult,
  handleSelfImproveCommand,
  handlePermissionsCommand,
  formatSwarmFeatures,
  handleSwarmCommand,
  handleMCPCommand,
  handleSkillsCommand,
  handleSlashCommand,
  startChat
};

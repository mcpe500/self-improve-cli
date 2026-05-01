#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { GROWTH_LEVELS, compileProfilePrompt, evaluatePatch, suggestPatchFromEvent } = require('../src/profile');
const { initWorkspace, loadProfiles, appendEvent, appendPatchAudit, applyPatchToOverlay, setGrowthLevel, getSelfImproveStatus, getStatus } = require('../src/state');
const { readFileTool, searchTool, runCommandTool, writeFileTool, editFileTool } = require('../src/tools');
const { loadConfig, setConfigValue, listPermissionModes, setPermissionMode } = require('../src/config');
const { runAgentTask, TOOL_SCHEMAS, startChat } = require('../src/agent');
const { learnFromMessage, runDemo, runBackgroundReview, runSelfImprovePropose } = require('../src/self-improve');

function usage() {
  return `sicli - lightweight self-improve coding CLI

Usage:
  sicli
  sicli chat [prompt...] [--yes] [--trace] [--dont-ask]
  sicli config show
  sicli config get <key>
  sicli config set <key> <value>
  sicli permissions [secure|partial_secure|ai_reviewed|auto_approve]
  sicli init
  sicli status
  sicli profile [--json|--prompt]
  sicli growth <none|low|medium|high|very_high> [--auto-apply true|false]
  sicli observe --type <kind> --message <text>
  sicli improve --type <kind> --message <text> [--apply]
  sicli self-improve status
  sicli self-improve demo [--apply]
  sicli self-improve learn <message> [--apply]
  sicli self-improve background-run [--quiet]
  sicli self-improve propose [--dry-run] [--limit <n>]
  sicli self-improve candidates
  sicli self-improve rollback [0|1|2]
  sicli self-improve benchmark
  sicli apply-patch <patch.json>
  sicli tool read <file>
  sicli tool search <text> [dir]
  sicli tool run <cmd> [args...]
  sicli tool write <file> <content>
  sicli tool edit <file> <old_text> <new_text>
  sicli swarm <prompt...> [--plan-only] [--concurrency <n>] [--max-critic-iterations <n>] [--yes]
  sicli mcp add <name> --command <cmd> [--args a1,a2] [--env KEY=VAL]
  sicli mcp remove <name>
  sicli mcp list
  sicli skills [list]
  sicli skills enable <name>
  sicli skills disable <name>

Notes:
  - State lives in .selfimprove/.
  - Base profile is immutable; overlay profile mutates.
  - Commands run with shell=false for portability.
  - Swarm mode splits a prompt into features and runs agents in parallel.
`;
}

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i += 1) {
    const item = args[i];
    if (item.startsWith('--')) {
      const key = item.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(item);
    }
  }
  return { flags, rest };
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function maybeApplyPatch(root, active, patch, event, manual) {
  const gate = evaluatePatch(active, patch, { manual });
  const audit = {
    event,
    patch,
    gate,
    applied: false
  };
  if (gate.allowed && (gate.auto || manual)) {
    await applyPatchToOverlay(root, patch);
    audit.applied = true;
  }
  await appendPatchAudit(root, audit);
  return audit;
}

function computeHarnessDiff(base, candidate) {
  const patches = [];
  for (const key of Object.keys(candidate)) {
    if (JSON.stringify(base[key]) !== JSON.stringify(candidate[key])) {
      patches.push({ op: 'replace', path: `/${key}`, value: candidate[key] });
    }
  }
  return patches;
}

async function main() {
  const root = process.cwd();
  const [command, ...args] = process.argv.slice(2);
  const { flags, rest } = command === 'tool' ? { flags: {}, rest: args } : parseFlags(args);

  if (command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(usage());
    return;
  }

  if (!command) {
    await startChat(root, { interactive: true });
    return;
  }

  if (command === 'init') {
    const dir = await initWorkspace(root);
    printJson({ ok: true, state_dir: dir });
    return;
  }

  if (command === 'status') {
    printJson(await getStatus(root));
    return;
  }

  if (command === 'config') {
    const [action, key, ...valueParts] = rest;
    if (!action || action === 'show') {
      printJson(await loadConfig(root));
      return;
    }
    if (action === 'get') {
      const config = await loadConfig(root);
      printJson({ [key]: config[key] });
      return;
    }
    if (action === 'set') {
      printJson(await setConfigValue(root, key, valueParts.join(' ')));
      return;
    }
    throw new Error(`unknown config action: ${action}`);
  }

  if (command === 'chat') {
    const prompt = rest.join(' ').trim();
    const isAutonomous = Boolean(flags.autonomous) || Boolean(flags['dont-ask']);
    if (!prompt) {
      await startChat(root, { interactive: true, yes: Boolean(flags.yes), trace: Boolean(flags.trace), autonomous: isAutonomous });
      return;
    }
    const controller = new AbortController();
    const onSignal = () => { controller.abort(); };
    process.on('SIGINT', onSignal);
    try {
      const result = await runAgentTask(root, prompt, { interactive: false, yes: Boolean(flags.yes), trace: Boolean(flags.trace), signal: controller.signal, autonomous: isAutonomous });
      if (result.autonomous) {
        process.stdout.write(`Status: ${result.status}\n`);
        if (result.deferredQuestions && result.deferredQuestions.length) {
          process.stdout.write(`Deferred questions: ${result.deferredQuestions.length}\n`);
        }
      }
      process.stdout.write(`${result.text}\n`);
    } catch (error) {
      if (error.name === 'AbortError') {
        process.stdout.write('[Cancelled]\n');
      } else {
        throw error;
      }
    } finally {
      process.removeListener('SIGINT', onSignal);
    }
    return;
  }

  if (command === 'swarm') {
    const prompt = rest.join(' ').trim();
    if (!prompt) throw new Error('usage: sicli swarm <prompt> [--plan-only] [--concurrency <n>] [--max-critic-iterations <n>] [--yes]');
    const { runSwarm } = require('../src/orchestrator');
    const controller = new AbortController();
    const onSignal = () => { controller.abort(); };
    process.on('SIGINT', onSignal);
    try {
      const result = await runSwarm(root, prompt, {
        planOnly: Boolean(flags['plan-only']),
        concurrency: parseInt(flags.concurrency || '3', 10),
        maxCriticIterations: parseInt(flags['max-critic-iterations'] || '1', 10),
        signal: controller.signal,
        interactive: false,
        yes: Boolean(flags.yes),
        runAgentTask,
        toolSchemas: TOOL_SCHEMAS
      });
      printJson(result);
    } catch (error) {
      if (error.name === 'AbortError') process.stdout.write('[Cancelled]\n');
      else throw error;
    } finally {
      process.removeListener('SIGINT', onSignal);
    }
    return;
  }

  if (command === 'self-improve') {
    const [action, ...messageParts] = rest;
    if (!action || action === 'status') {
      printJson(await getSelfImproveStatus(root));
      return;
    }
    if (action === 'demo') {
      printJson(await runDemo(root, { apply: Boolean(flags.apply) }));
      return;
    }
    if (action === 'learn') {
      const message = messageParts.join(' ');
      if (!message) throw new Error('usage: self-improve learn <message> [--apply]');
      printJson(await learnFromMessage(root, message, { apply: Boolean(flags.apply), type: 'user_lesson' }));
      return;
    }
    if (action === 'background-run') {
      const result = await runBackgroundReview(root);
      if (!flags.quiet) printJson(result);
      return;
    }
    if (action === 'sandbox-eval') {
      const { sandboxEvaluateCandidate } = await import('../src/self-improve.js');
      const { loadProfiles } = await import('../src/state.js');
      
      const candidateId = parseInt(rest[0], 10);
      const poolSize = parseInt(rest.find(a => a.startsWith('--workers='))?.split('=')[1] || '4', 10);
      
      let patch;
      if (!isNaN(candidateId)) {
        const { readFileSync } = require('node:fs');
        const path = require('node:path');
        const harnessPath = path.join(root, '.selfimprove', 'candidates', String(candidateId), 'harness.json');
        const harness = JSON.parse(readFileSync(harnessPath, 'utf8'));
        const { base, overlay } = await loadProfiles(root);
        const baseOverlay = { ...base, ...overlay };
        patch = computeHarnessDiff(baseOverlay, harness);
      }
      
      const result = await sandboxEvaluateCandidate(root, patch || [], { poolSize });
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (action === 'propose') {
      const result = await runSelfImprovePropose(root, {
        dryRun: Boolean(flags['dry-run']),
        limit: parseInt(flags.limit || '20', 10)
      });
      printJson(result);
      return;
    }
    if (action === 'candidates') {
      const { readAllJsonLines } = require('../src/state');
      const candidatesDir = require('node:path').join(root, '.selfimprove', 'candidates');
      let dirs = [];
      try {
        dirs = (await fs.readdir(candidatesDir)).filter((d) => /^run_\d+$/.test(d)).sort();
      } catch {}
      printJson({ candidates: dirs, count: dirs.length });
      return;
    }
    if (action === 'promote') {
      const id = parseInt(rest[0], 10);
      if (isNaN(id)) { console.error('Usage: self-improve promote <id>'); process.exit(1); }
      const { promoteCandidate } = await import('../src/self-improve.js');
      const result = await promoteCandidate(root, id);
      console.log('Promoted candidate', id, '->', result);
      return;
    }
    if (action === 'rollback') {
      const n = parseInt(rest[0] || '0', 10);
      const { rollbackToBackupFromNumber } = require('../src/state');
      printJson(await rollbackToBackupFromNumber(root, n));
      return;
    }
    if (action === 'benchmark') {
      const { runBenchmark } = require('../meta-harness/experiments/benchmark_tasks/benchmark_runner');
      printJson(await runBenchmark(root));
      return;
    }
    if (action === 'pareto') {
      const { evaluateParetoFrontier } = await import('../src/self-improve.js');
      const frontier = await evaluateParetoFrontier(root);
      console.log(JSON.stringify(frontier, null, 2));
      return;
    }
throw new Error(`unknown self-improve action: ${action}`);
  }

  if (command === 'daemon') {
    const daemonCmd = rest[0];
    const { runDaemonLoop, gracefulShutdown, isDaemonRunning, readDaemonPid, clearDaemonPid } = await import('../src/daemon.js');

    if (daemonCmd === 'start') {
      const running = await isDaemonRunning(root);
      if (running) {
        const pid = await readDaemonPid(root);
        console.log('Daemon already running with PID:', pid);
        process.exit(1);
      }

      const intervalMin = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '15', 10);
      const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3847', 10);
      const noAuto = args.includes('--no-auto-promote');

      const bin = path.join(__dirname, 'self-improve-cli.js');
      const child = spawn(process.execPath, [bin, 'daemon', 'run', `--interval=${intervalMin}`, `--port=${port}`, noAuto ? '--no-auto-promote' : ''], {
        cwd: root,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();

      const { writeDaemonPid } = await import('../src/state.js');
      await writeDaemonPid(root, child.pid);

      console.log(`Daemon started (PID: ${child.pid}, interval: ${intervalMin}min, port: ${port})`);
      console.log('Use "self-improve daemon status" to monitor');
    }

    else if (daemonCmd === 'run') {
      const intervalMin = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '15', 10);
      const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3847', 10);
      const autoPromote = !args.includes('--no-auto-promote');

      await runDaemonLoop(root, { intervalMinutes: intervalMin, port, autoPromote });
    }

    else if (daemonCmd === 'stop') {
      const running = await isDaemonRunning(root);
      if (!running) {
        console.log('Daemon not running');
        process.exit(1);
      }
      const { readDaemonState } = await import('../src/state.js');
      try {
        const http = require('http');
        const state = await readDaemonState(root);
        await new Promise(resolve => {
          const req = http.request({
            hostname: '127.0.0.1',
            port: state.port || 3847,
            path: '/stop',
            method: 'POST'
          }, () => resolve());
          req.on('error', () => resolve());
          req.end();
        });
        console.log('Stop signal sent');
      } catch {}

      await new Promise(r => setTimeout(r, 2000));
      console.log('Daemon stopped');
    }

    else if (daemonCmd === 'status') {
      const running = await isDaemonRunning(root);
      if (!running) {
        console.log('Daemon: not running');
        process.exit(1);
      }
      const pid = await readDaemonPid(root);
      const { readDaemonState } = await import('../src/state.js');
      const state = await readDaemonState(root);
      console.log(JSON.stringify({ running: true, pid, ...state }, null, 2));
    }

    else if (daemonCmd === 'logs') {
      const { statePath } = await import('../src/state.js');
      const logPath = path.join(root, '.selfimprove', 'daemon.log');
      const lines = args.find(a => a.startsWith('--tail='))?.split('=')[1] || 50;
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const allLines = content.split('\n').filter(Boolean);
        const lastLines = allLines.slice(-parseInt(lines, 10));
        console.log(lastLines.join('\n'));
      } catch {
        console.log('No daemon log found');
      }
    }

    else {
      console.log('Usage: self-improve daemon start|stop|status|logs');
      process.exit(1);
    }
    return;
  }

  if (command === 'profile') {
    const { active } = await loadProfiles(root);
    if (flags.prompt) process.stdout.write(`${compileProfilePrompt(active)}\n`);
    else printJson(active);
    return;
  }

  if (command === 'growth') {
    const level = rest[0];
    if (!GROWTH_LEVELS.has(level)) throw new Error(`growth level must be one of ${Array.from(GROWTH_LEVELS).join(', ')}`);
    const options = {};
    if (flags['auto-apply'] !== undefined) options.auto_apply = String(flags['auto-apply']) === 'true';
    const { active } = await setGrowthLevel(root, level, options);
    printJson({ ok: true, growth: active.growth });
    return;
  }

  if (command === 'observe') {
    const event = await appendEvent(root, {
      type: flags.type || 'note',
      message: flags.message || rest.join(' ')
    });
    printJson({ ok: true, event });
    return;
  }

  if (command === 'improve') {
    const { active } = await loadProfiles(root);
    const event = await appendEvent(root, {
      type: flags.type || 'failure',
      message: flags.message || rest.join(' ')
    });
    const suggestion = suggestPatchFromEvent(event);
    const audit = await maybeApplyPatch(root, active, suggestion.patch, event, Boolean(flags.apply));
    printJson({ ok: true, suggestion, audit });
    return;
  }

  if (command === 'apply-patch') {
    const patchFile = rest[0];
    if (!patchFile) throw new Error('patch file required');
    const patch = JSON.parse(await fs.readFile(patchFile, 'utf8'));
    const { active } = await loadProfiles(root);
    const audit = await maybeApplyPatch(root, active, patch, { type: 'manual_patch', patchFile }, true);
    printJson({ ok: audit.applied, audit });
    return;
  }

  if (command === 'tool') {
    const [tool, ...toolArgs] = rest;
    if (tool === 'read') {
      printJson(await readFileTool(root, toolArgs[0]));
      return;
    }
    if (tool === 'search') {
      printJson(await searchTool(root, toolArgs[0], toolArgs[1] || '.'));
      return;
    }
    if (tool === 'run') {
      printJson(await runCommandTool(root, toolArgs[0], toolArgs.slice(1)));
      return;
    }
    if (tool === 'write') {
      printJson(await writeFileTool(root, toolArgs[0], toolArgs.slice(1).join(' ')));
      return;
    }
    if (tool === 'edit') {
      printJson(await editFileTool(root, toolArgs[0], toolArgs[1], toolArgs[2] || ''));
      return;
    }
    throw new Error(`unknown tool: ${tool || '(missing)'}`);
  }

  if (command === 'mcp') {
    const { loadMcpConfig, saveMcpConfig } = require('../src/state');
    const [action, ...mcpRest] = rest;
    if (action === 'add') {
      const name = flags.name || mcpRest[0];
      const cmd = flags.command;
      if (!name || !cmd) throw new Error('usage: sicli mcp add <name> --command <cmd> [--args a1,a2] [--env KEY=VAL]');
      let mArgs = [];
      if (typeof flags.args === 'string') mArgs = flags.args.split(',');
      const env = {};
      if (flags.env) {
        const pairs = Array.isArray(flags.env) ? flags.env : [flags.env];
        for (const p of pairs) {
          const eqIdx = p.indexOf('=');
          if (eqIdx > 0) env[p.slice(0, eqIdx)] = p.slice(eqIdx + 1);
        }
      }
      const config = await loadMcpConfig(root);
      config.mcpServers[name] = { command: cmd, args: mArgs, env };
      await saveMcpConfig(root, config);
      printJson({ ok: true, name, config: config.mcpServers[name] });
      return;
    }
    if (action === 'remove') {
      const name = mcpRest[0];
      if (!name) throw new Error('usage: sicli mcp remove <name>');
      const config = await loadMcpConfig(root);
      if (!config.mcpServers[name]) throw new Error(`Server "${name}" not found`);
      delete config.mcpServers[name];
      await saveMcpConfig(root, config);
      printJson({ ok: true, removed: name });
      return;
    }
    if (action === 'list') {
      const config = await loadMcpConfig(root);
      const servers = [];
      for (const [name, sc] of Object.entries(config.mcpServers || {})) {
        servers.push({ name, type: sc.url ? 'remote' : 'stdio', command: sc.command || sc.url });
      }
      printJson({ servers, count: servers.length });
      return;
    }
    throw new Error(`unknown mcp action: ${action}. Use add, remove, or list.`);
  }

  if (command === 'skills') {
    const { discoverSkills } = require('../src/skills');
    const { enableSkill, disableSkill } = require('../src/skills');
    const { loadProfiles } = require('../src/state');
    const [action, ...skillsRest] = rest;
    if (action === 'list' || !action) {
      const discovered = await discoverSkills(root);
      const { active } = await loadProfiles(root);
      const activeNames = active.memory?.active_skills || [];
      const skills = discovered.map(s => ({ name: s.name, description: s.description, active: activeNames.includes(s.name) }));
      printJson({ skills, count: skills.length });
      return;
    }
    if (action === 'enable') {
      const name = skillsRest[0];
      if (!name) throw new Error('usage: sicli skills enable <name>');
      await enableSkill(root, name);
      printJson({ ok: true, enabled: name });
      return;
    }
    if (action === 'disable') {
      const name = skillsRest[0];
      if (!name) throw new Error('usage: sicli skills disable <name>');
      await disableSkill(root, name);
      printJson({ ok: true, disabled: name });
      return;
    }
    throw new Error(`unknown skills action: ${action}. Use list, enable, or disable.`);
  }

  if (command === 'history') {
    const { handleHistoryCommand } = require('../src/commands/chat-commands');
    await handleHistoryCommand(root, rest.join(' '), null);
    return;
  }

  if (command === 'revert') {
    const { handleRevertCommand } = require('../src/commands/chat-commands');
    await handleRevertCommand(root, rest.join(' '), null);
    return;
  }

  if (command === 'plan') {
    const { handlePlanCommand } = require('../src/commands/chat-commands');
    await handlePlanCommand(root, rest.join(' '), null);
    return;
  }

  if (command === 'build') {
    const { handleBuildCommand } = require('../src/commands/chat-commands');
    await handleBuildCommand(root, rest.join(' '), null);
    return;
  }

  if (command === 'llm-council') {
    const { handleLlmCouncilCommand } = require('../src/commands/chat-commands');
    await handleLlmCouncilCommand(root, rest.join(' '), null);
    return;
  }

  if (command === 'import') {
    const { handleImportCommand } = require('../src/commands/chat-commands');
    await handleImportCommand(root, rest.join(' '), null);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});

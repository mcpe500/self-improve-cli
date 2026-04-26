#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const { GROWTH_LEVELS, compileProfilePrompt, evaluatePatch, suggestPatchFromEvent } = require('../src/profile');
const { initWorkspace, loadProfiles, appendEvent, appendPatchAudit, applyPatchToOverlay, setGrowthLevel, getStatus } = require('../src/state');
const { readFileTool, searchTool, runCommandTool } = require('../src/tools');

function usage() {
  return `sicli - lightweight self-improve coding CLI

Usage:
  sicli init
  sicli status
  sicli profile [--json|--prompt]
  sicli growth <none|low|medium|high|very_high> [--auto-apply true|false]
  sicli observe --type <kind> --message <text>
  sicli improve --type <kind> --message <text> [--apply]
  sicli apply-patch <patch.json>
  sicli tool read <file>
  sicli tool search <text> [dir]
  sicli tool run <cmd> [args...]

Notes:
  - State lives in .selfimprove/.
  - Base profile is immutable; overlay profile mutates.
  - Commands run with shell=false for portability.
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

async function main() {
  const root = process.cwd();
  const [command, ...args] = process.argv.slice(2);
  const { flags, rest } = command === 'tool' ? { flags: {}, rest: args } : parseFlags(args);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(usage());
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
    throw new Error(`unknown tool: ${tool || '(missing)'}`);
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
});

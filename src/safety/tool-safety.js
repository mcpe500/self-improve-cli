'use strict';

const path = require('node:path');
const { chatCompletion } = require('../provider');
const { runCommandTool } = require('../tools');
const { askApproval } = require('../commands/chat-commands');
const { stripThinkBlocks, compactJson } = require('../text-utils');

const TOOL_POLICY_KEYS = {
  read_file: 'read_file',
  search: 'search',
  run_command: 'run_command',
  write_file: 'write_file',
  edit_file: 'edit_file',
  ask_user: 'ask_user',
  task_complete: 'task_complete',
  delegate_swarm: 'delegate_swarm'
};

async function askToolPermission(name, args, options, reason = '') {
  if (options.yes) return;
  if (!options.interactive) throw new Error(`Tool requires approval: ${name}. ${reason} Re-run with --yes or use interactive chat.`.trim());
  const suffix = reason ? ` (${reason})` : '';
  const ok = await askApproval(`Allow ${name} ${compactJson(args, 500)}${suffix}?`, options.rl);
  if (!ok) throw new Error(`Tool not approved: ${name}`);
}

function fileTargetForTool(name, args) {
  if (name === 'write_file' || name === 'edit_file' || name === 'read_file') return args.path;
  return '';
}

async function isGitReversibleFileAction(root, name, args) {
  const target = fileTargetForTool(name, args);
  if (!target) return false;
  const absolute = path.resolve(root, target);
  let exists = true;
  try {
    await require('node:fs/promises').access(absolute);
  } catch {
    exists = false;
  }
  const inside = await runCommandTool(root, 'git', ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0) return false;
  if (!exists && name === 'write_file') return true;
  const status = await runCommandTool(root, 'git', ['status', '--porcelain', '--', target]);
  if (status.code !== 0) return false;
  if (status.stdout.trim()) return false;
  const tracked = await runCommandTool(root, 'git', ['ls-files', '--error-unmatch', '--', target]);
  return tracked.code === 0;
}

async function reviewToolSafety(root, config, name, args, signal) {
  const prompt = `Review this proposed local coding-agent tool call for safety. Reply only JSON: {"approved": boolean, "reason": string}.\nTool: ${name}\nArgs: ${compactJson(args, 4000)}\nRules:\n- Approve read/search.\n- Approve write/edit only if normal coding task and path looks safe.\n- Reject destructive commands, secret exfiltration, network install scripts, deletion, chmod/chown, rm, format, credential access, or unclear broad changes.\n- For run_command, approve only clearly safe tests/status/read-only commands.`;
  const reviewer = await chatCompletion(root, config, [
    { role: 'system', content: 'You are a strict security reviewer. No tools. Return JSON only.' },
    { role: 'user', content: prompt }
  ], [], signal);
  const text = stripThinkBlocks(reviewer.content || '').replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(text);
    return { approved: Boolean(parsed.approved), reason: String(parsed.reason || '') };
  } catch {
    return { approved: false, reason: `reviewer returned non-JSON: ${text.slice(0, 200)}` };
  }
}

async function ensureAllowed(root, profile, config, name, args, options) {
  const policyKey = TOOL_POLICY_KEYS[name];
  const policy = profile.tool_policy[policyKey] || 'deny';
  if (policy === 'deny') throw new Error(`Tool denied by profile: ${name}`);
  if (!['allow', 'ask'].includes(policy)) throw new Error(`Unknown tool policy for ${name}: ${policy}`);

  const mode = config.permission_mode;
  if (mode === 'auto_approve') return;
  if (mode === 'secure') return askToolPermission(name, args, options, 'secure mode');
  if (mode === 'partial_secure') {
    if (name === 'read_file' || name === 'search') return;
    if ((name === 'write_file' || name === 'edit_file') && await isGitReversibleFileAction(root, name, args)) return;
    return askToolPermission(name, args, options, 'not proven git-reversible');
  }
  if (mode === 'ai_reviewed') {
    if (name === 'read_file' || name === 'search') return;
    let review;
    try {
      review = await reviewToolSafety(options.root || process.cwd(), config, name, args, options.signal);
    } catch (error) {
      review = { approved: false, reason: `review failed: ${error.message}` };
    }
    if (review.approved) {
      if (options.interactive) process.stdout.write(`✓ ai_review ${review.reason || 'approved'}\n`);
      return;
    }
    return askToolPermission(name, args, options, `AI review: ${review.reason || 'not approved'}`);
  }
  throw new Error(`Unknown permission mode: ${mode}`);
}

module.exports = {
  TOOL_POLICY_KEYS,
  askToolPermission,
  fileTargetForTool,
  isGitReversibleFileAction,
  reviewToolSafety,
  ensureAllowed
};

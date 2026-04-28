'use strict';

const { runAgentTask, TOOL_SCHEMAS } = require('./agent');
const { chatCompletion } = require('./provider');
const { loadConfig } = require('./config');
const { loadProfiles } = require('./state');
const { runCommandTool } = require('./tools');
const { MMX_TOOL_SCHEMAS, MMX_TOOL_HANDLERS } = require('./mmx-tools');
const path = require('node:path');
const fs = require('node:fs/promises');

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an expert software architect and orchestrator. Your job is to analyze a user request and break it into a set of independent, implementable features.

Rules:
- Each feature must be self-contained and independently implementable.
- Identify dependencies between features (by referencing other feature ids).
- Return ONLY a JSON object with this shape:
{
  "features": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "dependencies": ["other-feature-id"],
      "estimated_effort": "low|medium|high"
    }
  ]
}
- Do not include explanations outside the JSON.`;

const CRITIC_SYSTEM_PROMPT = `You are a strict code reviewer. Review the agent's implementation for correctness, safety, and completeness.

Review criteria:
- Does the implementation match the feature description?
- Are file modifications safe and correct?
- Are there missing edge cases or tests?
- Return ONLY JSON: {"approved": boolean, "feedback": "string", "severity": "none|minor|major|critical", "suggested_fixes": ["string"]}`;

function stripThinkBlocks(text) {
  return String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function extractTouchedFiles(messages) {
  const files = new Set();
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name;
        if (name === 'write_file' || name === 'edit_file' || name === 'read_file') {
          try {
            const args = JSON.parse(tc.function.arguments || '{}');
            if (args.path) files.add(args.path);
          } catch {}
        }
      }
    }
  }
  return Array.from(files);
}

async function planFeatures(root, config, prompt, options) {
  const messages = [
    { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
    { role: 'user', content: `Workspace: ${process.cwd()}\nPlatform: ${process.platform}\n\nBreak this request into features:\n${prompt}` }
  ];
  const response = await chatCompletion(root, config, messages, [], options.signal);
  const text = stripThinkBlocks(response.message.content)
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Orchestrator returned invalid JSON: ${text.slice(0, 500)}`);
  }
  if (!Array.isArray(parsed.features)) {
    throw new Error('Orchestrator response missing features array');
  }
  return parsed.features.map((f, i) => ({ ...f, id: f.id || `feature-${i}` }));
}

async function runCritic(root, config, feature, workerResult, options) {
  const touchedFiles = extractTouchedFiles(workerResult.messages);
  const reviewPrompt = `Feature: ${feature.title}\nDescription: ${feature.description}\n\nFiles touched: ${touchedFiles.join(', ') || 'none'}\n\nAgent final text: ${workerResult.text}\n\nVerification status: ${workerResult.verificationStatus || 'unknown'}\n\nReview this implementation.`;

  const messages = [
    { role: 'system', content: CRITIC_SYSTEM_PROMPT },
    { role: 'user', content: reviewPrompt }
  ];
  const response = await chatCompletion(root, config, messages, [], options.signal);
  const text = stripThinkBlocks(response.message.content)
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    return { approved: false, feedback: `Critic returned invalid JSON: ${text.slice(0, 200)}`, severity: 'major', suggested_fixes: [] };
  }
}

async function persistSwarmArtifact(root, runId, name, data) {
  const dir = path.join(root, '.selfimprove', 'swarm', runId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2), 'utf8');
}

async function runFeatureAgent(root, feature, options) {
  const { active } = await loadProfiles(root);
  const config = await loadConfig(root);

  const featurePrompt = `Implement this feature:\nTitle: ${feature.title}\nDescription: ${feature.description}\nDependencies: ${feature.dependencies?.join(', ') || 'none'}\n\nBegin implementation now.`;

  const swarmTools = options.enableMmx
    ? [...TOOL_SCHEMAS, ...MMX_TOOL_SCHEMAS]
    : TOOL_SCHEMAS;
  const swarmHandlers = options.enableMmx
    ? { ...MMX_TOOL_HANDLERS }
    : {};

  const workerOptions = {
    ...options,
    autonomous: true,
    maxTurns: options.maxTurns || active.harness?.max_tool_turns_autonomous || 25,
    tools: swarmTools,
    toolHandlers: swarmHandlers
  };

  // Worker phase
  let workerResult = await runAgentTask(root, featurePrompt, workerOptions);

  // Critic phase
  let approved = false;
  let criticResult = null;
  const maxCriticIterations = options.maxCriticIterations || 1;

  for (let i = 0; i < maxCriticIterations; i++) {
    criticResult = await runCritic(root, config, feature, workerResult, options);
    if (criticResult.approved) {
      approved = true;
      break;
    }
    if (i < maxCriticIterations - 1) {
      const retryPrompt = `The reviewer provided feedback. Address it before finishing.\n\nReviewer feedback (${criticResult.severity}): ${criticResult.feedback}\n\nSuggested fixes:\n${criticResult.suggested_fixes?.join('\n') || 'None provided.'}`;
      const retryResult = await runAgentTask(root, retryPrompt, {
        ...workerOptions,
        history: workerResult.messages,
        maxTurns: Math.min(workerOptions.maxTurns, 15)
      });
      workerResult = retryResult;
    }
  }

  return {
    feature,
    status: approved ? 'completed' : 'completed_with_warnings',
    workerResult: {
      text: workerResult.text,
      status: workerResult.status,
      verificationStatus: workerResult.verificationStatus,
      touchedFiles: extractTouchedFiles(workerResult.messages)
    },
    criticResult
  };
}

function mergeResults(results) {
  const successful = [];
  const failed = [];
  const warnings = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      failed.push({ error: result.reason?.message || String(result.reason) });
      continue;
    }
    const val = result.value;
    if (val.status === 'completed') {
      successful.push(val);
    } else if (val.status === 'completed_with_warnings') {
      warnings.push(val);
    } else {
      failed.push(val);
    }
  }

  return {
    ok: failed.length === 0,
    summary: `Features: ${successful.length} succeeded, ${warnings.length} with warnings, ${failed.length} failed. Total: ${results.length}.`,
    successful,
    warnings,
    failed
  };
}

async function runSwarm(root, prompt, options = {}) {
  const config = await loadConfig(root);
  const runId = options.runId || `swarm-${Date.now()}`;

  // Planning phase
  const features = await planFeatures(root, config, prompt, options);
  await persistSwarmArtifact(root, runId, 'plan.json', { prompt, features, timestamp: Date.now() });

  if (options.planOnly) {
    return { runId, plan: features, executed: false };
  }

  // Execution phase with concurrency limit
  const concurrency = options.concurrency || 3;
  const results = [];

  for (let i = 0; i < features.length; i += concurrency) {
    if (options.signal?.aborted) throw new Error('AbortError');
    const batch = features.slice(i, i + concurrency).map(feature =>
      runFeatureAgent(root, feature, options).catch(error => ({
        feature,
        status: 'failed',
        error: error.message
      }))
    );
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }

  const merged = mergeResults(results);
  const output = { runId, prompt, merged, timestamp: Date.now() };
  await persistSwarmArtifact(root, runId, 'results.json', output);

  return output;
}

module.exports = {
  runSwarm,
  planFeatures,
  runFeatureAgent,
  runCritic,
  mergeResults
};

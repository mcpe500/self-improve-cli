'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BUILT_IN_AGENTS,
  listBuiltInAgentNames,
  getBuiltInAgent,
  listCustomAgents,
  listAllAgents,
  getAgent,
  resolveAgent,
  parseAgentMention,
} = require('../src/agents');

test('BUILT_IN_AGENTS has 4 agents', () => {
  assert.equal(Object.keys(BUILT_IN_AGENTS).length, 4);
  assert.ok(BUILT_IN_AGENTS.plan);
  assert.ok(BUILT_IN_AGENTS.build);
  assert.ok(BUILT_IN_AGENTS.explore);
  assert.ok(BUILT_IN_AGENTS.scout);
});

test('listBuiltInAgentNames returns names', () => {
  const names = listBuiltInAgentNames();
  assert.ok(names.includes('plan'));
  assert.ok(names.includes('build'));
  assert.ok(names.includes('explore'));
  assert.ok(names.includes('scout'));
});

test('getBuiltInAgent returns agent', () => {
  const agent = getBuiltInAgent('plan');
  assert.ok(agent);
  assert.equal(agent.name, 'plan');
  assert.ok(agent.description);
  assert.ok(agent.systemPrompt);
});

test('getBuiltInAgent returns null for unknown', () => {
  assert.equal(getBuiltInAgent('unknown'), null);
});

test('plan agent has PLAN mode', () => {
  const agent = getBuiltInAgent('plan');
  assert.equal(agent.mode, 'plan');
});

test('build agent has BUILD mode', () => {
  const agent = getBuiltInAgent('build');
  assert.equal(agent.mode, 'build');
});

test('listCustomAgents returns empty for no config', () => {
  assert.deepEqual(listCustomAgents({}), []);
});

test('listCustomAgents returns custom agents', () => {
  const config = {
    agents: {
      reviewer: {
        description: 'Code reviewer',
        system_prompt: 'Review code carefully.',
        model: 'gpt-4.1-mini',
      },
    },
  };
  const agents = listCustomAgents(config);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].name, 'reviewer');
  assert.equal(agents[0].description, 'Code reviewer');
  assert.equal(agents[0].custom, true);
});

test('listAllAgents combines built-in and custom', () => {
  const config = {
    agents: { custom1: { description: 'Custom' } },
  };
  const agents = listAllAgents(config);
  assert.equal(agents.length, 5); // 4 built-in + 1 custom
});

test('getAgent returns built-in', () => {
  const agent = getAgent('plan');
  assert.equal(agent.name, 'plan');
});

test('getAgent returns custom', () => {
  const config = { agents: { reviewer: { description: 'Reviewer' } } };
  const agent = getAgent('reviewer', config);
  assert.equal(agent.name, 'reviewer');
});

test('getAgent returns null for unknown', () => {
  assert.equal(getAgent('unknown', {}), null);
});

test('resolveAgent returns full settings', () => {
  const resolved = resolveAgent('plan', { active_model: 'gpt-4' });
  assert.equal(resolved.name, 'plan');
  assert.equal(resolved.mode, 'plan');
  assert.equal(resolved.model, 'gpt-4');
  assert.ok(resolved.permissions);
  assert.equal(resolved.permissions.write, 'deny'); // plan mode denies write
});

test('resolveAgent returns null for unknown', () => {
  assert.equal(resolveAgent('unknown', {}), null);
});

test('parseAgentMention extracts @agent', () => {
  const result = parseAgentMention('@plan analyze this code');
  assert.equal(result.agent, 'plan');
  assert.equal(result.text, 'analyze this code');
});

test('parseAgentMention returns null agent without mention', () => {
  const result = parseAgentMention('just a prompt');
  assert.equal(result.agent, null);
  assert.equal(result.text, 'just a prompt');
});

test('parseAgentMention handles multi-line text', () => {
  const result = parseAgentMention('@build fix this\n\nDetails here');
  assert.equal(result.agent, 'build');
  assert.ok(result.text.includes('fix this'));
});

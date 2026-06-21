'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  parseFrontmatter,
  substituteVariables,
  discoverCustomCommands,
  loadCustomCommand,
  executeCustomCommand,
  createCustomCommand,
} = require('../src/commands/custom-commands');

test('parseFrontmatter with frontmatter', () => {
  const content = `---
description: Test command
agent: build
---

This is the body.`;
  
  const { frontmatter, body } = parseFrontmatter(content);
  assert.equal(frontmatter.description, 'Test command');
  assert.equal(frontmatter.agent, 'build');
  assert.equal(body, 'This is the body.');
});

test('parseFrontmatter without frontmatter', () => {
  const content = 'Just body text.';
  const { frontmatter, body } = parseFrontmatter(content);
  assert.deepEqual(frontmatter, {});
  assert.equal(body, 'Just body text.');
});

test('substituteVariables with $ARGUMENTS', () => {
  const body = 'Run tests for $ARGUMENTS';
  const result = substituteVariables(body, ['src/', 'test/']);
  assert.equal(result, 'Run tests for src/ test/');
});

test('substituteVariables with positional args', () => {
  const body = 'Fix $1 in file $2';
  const result = substituteVariables(body, ['bug', 'auth.js']);
  assert.equal(result, 'Fix bug in file auth.js');
});

test('substituteVariables with no args', () => {
  const body = 'Run all tests';
  const result = substituteVariables(body, []);
  assert.equal(result, 'Run all tests');
});

test('discoverCustomCommands in empty dir', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const commands = await discoverCustomCommands(tmpDir);
  assert.deepEqual(commands, []);
  await fs.rm(tmpDir, { recursive: true });
});

test('discoverCustomCommands finds .md files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const commandsDir = path.join(tmpDir, '.selfimprove', 'commands');
  await fs.mkdir(commandsDir, { recursive: true });
  
  await fs.writeFile(
    path.join(commandsDir, 'test.md'),
    '---\ndescription: Test\n---\n\nTest body',
  );
  
  const commands = await discoverCustomCommands(tmpDir);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].name, 'test');
  assert.equal(commands[0].frontmatter.description, 'Test');
  assert.equal(commands[0].body, 'Test body');
  
  await fs.rm(tmpDir, { recursive: true });
});

test('loadCustomCommand returns null for missing command', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const result = await loadCustomCommand(tmpDir, 'missing');
  assert.equal(result, null);
  await fs.rm(tmpDir, { recursive: true });
});

test('loadCustomCommand returns command by name', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const commandsDir = path.join(tmpDir, '.selfimprove', 'commands');
  await fs.mkdir(commandsDir, { recursive: true });
  
  await fs.writeFile(
    path.join(commandsDir, 'deploy.md'),
    '---\ndescription: Deploy\n---\n\nDeploy to $1',
  );
  
  const command = await loadCustomCommand(tmpDir, 'deploy');
  assert.equal(command.name, 'deploy');
  assert.equal(command.body, 'Deploy to $1');
  
  await fs.rm(tmpDir, { recursive: true });
});

test('executeCustomCommand substitutes variables', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  const commandsDir = path.join(tmpDir, '.selfimprove', 'commands');
  await fs.mkdir(commandsDir, { recursive: true });
  
  await fs.writeFile(
    path.join(commandsDir, 'fix.md'),
    '---\ndescription: Fix bug\nagent: build\n---\n\nFix $1 in $2',
  );
  
  const result = await executeCustomCommand(tmpDir, 'fix', ['auth bug', 'src/auth.js']);
  assert.equal(result.prompt, 'Fix auth bug in src/auth.js');
  assert.equal(result.agent, 'build');
  assert.equal(result.description, 'Fix bug');
  
  await fs.rm(tmpDir, { recursive: true });
});

test('executeCustomCommand throws for missing command', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  await assert.rejects(
    async () => await executeCustomCommand(tmpDir, 'missing', []),
    /Custom command not found: missing/
  );
  await fs.rm(tmpDir, { recursive: true });
});

test('createCustomCommand creates file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  const filepath = await createCustomCommand(tmpDir, 'test', {
    description: 'Test command',
    agent: 'build',
    body: 'Test body',
  });
  
  const content = await fs.readFile(filepath, 'utf8');
  assert.ok(content.includes('description: Test command'));
  assert.ok(content.includes('agent: build'));
  assert.ok(content.includes('Test body'));
  
  await fs.rm(tmpDir, { recursive: true });
});

test('createCustomCommand throws if command exists', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sicli-test-'));
  
  await createCustomCommand(tmpDir, 'test', { body: 'Test' });
  
  await assert.rejects(
    async () => await createCustomCommand(tmpDir, 'test', { body: 'Test 2' }),
    /Command already exists: test/
  );
  
  await fs.rm(tmpDir, { recursive: true });
});

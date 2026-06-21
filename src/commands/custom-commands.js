'use strict';

/**
 * Custom Commands - Markdown-based user-defined workflows
 * 
 * Inspired by OpenCode's custom commands.
 * Commands are defined in `.selfimprove/commands/*.md` with frontmatter.
 */

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Parse markdown frontmatter.
 * 
 * @param {string} content - markdown content
 * @returns {object} { frontmatter, body }
 */
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content.trim() };
  }

  const frontmatterText = match[1];
  const body = match[2].trim();
  const frontmatter = {};

  // Parse simple key: value pairs
  const lines = frontmatterText.split(/\r?\n/);
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/**
 * Substitute variables in command body.
 * 
 * @param {string} body - command body
 * @param {string[]} args - command arguments
 * @returns {string} substituted body
 */
function substituteVariables(body, args = []) {
  let result = body;

  // $ARGUMENTS = all args joined
  result = result.replace(/\$ARGUMENTS/g, args.join(' '));

  // $1, $2, $3, etc = positional args
  args.forEach((arg, index) => {
    const pattern = new RegExp(`\\$${index + 1}`, 'g');
    result = result.replace(pattern, arg);
  });

  return result;
}

/**
 * Discover custom commands in workspace.
 * 
 * @param {string} root - workspace root
 * @returns {Promise<object[]>} array of { name, path, frontmatter, body }
 */
async function discoverCustomCommands(root) {
  const commands = [];
  const commandsDir = path.join(root, '.selfimprove', 'commands');

  try {
    const files = await fs.readdir(commandsDir);
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      const filepath = path.join(commandsDir, file);
      const content = await fs.readFile(filepath, 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);
      const name = path.basename(file, '.md');

      commands.push({
        name,
        path: filepath,
        frontmatter,
        body,
      });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  return commands;
}

/**
 * Load a custom command by name.
 * 
 * @param {string} root - workspace root
 * @param {string} name - command name
 * @returns {Promise<object|null>} { name, frontmatter, body } or null
 */
async function loadCustomCommand(root, name) {
  const commands = await discoverCustomCommands(root);
  return commands.find(c => c.name === name) || null;
}

/**
 * Execute a custom command.
 * 
 * @param {string} root - workspace root
 * @param {string} name - command name
 * @param {string[]} args - command arguments
 * @returns {Promise<object>} { prompt, agent, model }
 */
async function executeCustomCommand(root, name, args = []) {
  const command = await loadCustomCommand(root, name);
  
  if (!command) {
    throw new Error(`Custom command not found: ${name}`);
  }

  const prompt = substituteVariables(command.body, args);
  const agent = command.frontmatter.agent || null;
  const model = command.frontmatter.model || null;

  return { prompt, agent, model, description: command.frontmatter.description || '' };
}

/**
 * Create a new custom command.
 * 
 * @param {string} root - workspace root
 * @param {string} name - command name
 * @param {object} options - { description, agent, model, body }
 */
async function createCustomCommand(root, name, options = {}) {
  const commandsDir = path.join(root, '.selfimprove', 'commands');
  await fs.mkdir(commandsDir, { recursive: true });

  const filepath = path.join(commandsDir, `${name}.md`);
  
  // Check if exists
  try {
    await fs.access(filepath);
    throw new Error(`Command already exists: ${name}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // Build frontmatter
  const frontmatter = [];
  if (options.description) frontmatter.push(`description: ${options.description}`);
  if (options.agent) frontmatter.push(`agent: ${options.agent}`);
  if (options.model) frontmatter.push(`model: ${options.model}`);

  const content = [
    '---',
    ...frontmatter,
    '---',
    '',
    options.body || 'Add your prompt here.',
  ].join('\n');

  await fs.writeFile(filepath, content, 'utf8');
  return filepath;
}

module.exports = {
  parseFrontmatter,
  substituteVariables,
  discoverCustomCommands,
  loadCustomCommand,
  executeCustomCommand,
  createCustomCommand,
};

'use strict';

const { runCommandTool } = require('./tools');

const MMX_TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'mmx_search',
      description: 'Web search via MiniMax mmx-cli',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mmx_text_chat',
      description: 'Generate text via MiniMax API using mmx-cli',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'User message' },
          system: { type: 'string', description: 'Optional system prompt' }
        },
        required: ['message'],
        additionalProperties: false
      }
    }
  }
];

async function executeMmxSearch(root, args, options) {
  return runCommandTool(root, 'mmx', ['search', 'query', '--q', String(args.query), '--output', 'json', '--quiet'], { signal: options.signal });
}

async function executeMmxTextChat(root, args, options) {
  const cmdArgs = ['text', 'chat', '--message', `user:${String(args.message)}`, '--output', 'json', '--quiet'];
  if (args.system) cmdArgs.push('--system', String(args.system));
  return runCommandTool(root, 'mmx', cmdArgs, { signal: options.signal });
}

const MMX_TOOL_HANDLERS = {
  mmx_search: executeMmxSearch,
  mmx_text_chat: executeMmxTextChat
};

module.exports = {
  MMX_TOOL_SCHEMAS,
  MMX_TOOL_HANDLERS
};

'use strict';

const { StdioTransport, HTTPTransport } = require('./mcp-transport');

const PROTOCOL_VERSION = '2024-11-05';
const CLIENT_INFO = { name: 'self-improve-cli', version: '1.0.0' };

function convertInputSchema(inputSchema) {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return { type: 'object', properties: {}, additionalProperties: false };
  }
  const schema = { ...inputSchema, additionalProperties: false };
  if (schema.properties && typeof schema.properties === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      const clone = { ...v };
      delete clone.default;
      if (clone.properties && typeof clone.properties === 'object') {
        const inner = {};
        for (const [ik, iv] of Object.entries(clone.properties)) {
          const ic = { ...iv };
          delete ic.default;
          inner[ik] = ic;
        }
        clone.properties = inner;
      }
      if (clone.items && typeof clone.items === 'object' && clone.items.properties) {
        const itemsProps = {};
        for (const [ik, iv] of Object.entries(clone.items.properties)) {
          const ic = { ...iv };
          delete ic.default;
          itemsProps[ik] = ic;
        }
        clone.items = { ...clone.items, properties: itemsProps };
      }
      cleaned[k] = clone;
    }
    schema.properties = cleaned;
  }
  return schema;
}

class MCPClient {
  constructor(serverName, serverConfig, defaults) {
    this.serverName = serverName;
    this.serverConfig = serverConfig;
    this.defaults = defaults || {};
    this.tools = [];
    this.initialized = false;
    if (serverConfig.command) {
      this.transport = new StdioTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        timeout: serverConfig.timeout || this.defaults.timeout || 30000
      });
    } else if (serverConfig.url) {
      this.transport = new HTTPTransport({
        url: serverConfig.url,
        headers: serverConfig.headers || {},
        timeout: serverConfig.timeout || this.defaults.timeout || 30000
      });
    } else {
      throw new Error(`MCP server "${serverName}" has no "command" or "url"`);
    }
  }

  async initialize() {
    await this.transport.connect();
    const result = await this.transport.send({
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO
      }
    });
    await this.transport.notify({
      method: 'notifications/initialized'
    });
    this.initialized = true;
    return { serverInfo: result?.serverInfo, capabilities: result?.capabilities };
  }

  async listTools() {
    const result = await this.transport.send({
      method: 'tools/list',
      params: {}
    });
    this.tools = result?.tools || [];
    return this.tools;
  }

  async callTool(toolName, args) {
    const result = await this.transport.send({
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
    const content = result?.content || [];
    const texts = content.filter(c => c.type === 'text').map(c => c.text);
    const text = texts.join('\n');
    if (result?.isError) {
      throw new Error(text || 'MCP tool call failed');
    }
    return text;
  }

  getToolSchemas() {
    return this.tools.map(tool => ({
      type: 'function',
      function: {
        name: `mcp__${this.serverName}__${tool.name}`,
        description: `[MCP:${this.serverName}] ${tool.description || tool.name}`,
        parameters: convertInputSchema(tool.inputSchema)
      }
    }));
  }

  async shutdown() {
    this.tools = [];
    this.initialized = false;
    this.transport.disconnect();
  }
}

class MCPManager {
  constructor(root, mcpConfig) {
    this.root = root;
    this.mcpConfig = mcpConfig;
    this.clients = new Map();
    this.schemas = [];
    this.handlers = {};
  }

  async discover() {
    const servers = this.mcpConfig.mcpServers || {};
    const defaults = this.mcpConfig.defaults || {};
    const entries = Object.entries(servers);

    for (const [name, config] of entries) {
      try {
        const client = new MCPClient(name, config, defaults);
        await client.initialize();
        await client.listTools();
        this.clients.set(name, client);
        this.schemas.push(...client.getToolSchemas());
      } catch (err) {
        process.stderr.write(`mcp: server "${name}" init failed: ${err.message}\n`);
      }
    }

    this.handlers = this._buildHandlers();
    return { schemas: this.schemas, handlers: this.handlers };
  }

  _buildHandlers() {
    const handlers = {};
    for (const [name, client] of this.clients) {
      const policy = this.getToolPolicy(name);
      if (policy === 'deny') continue;
      for (const tool of client.tools) {
        const prefixed = `mcp__${name}__${tool.name}`;
        handlers[prefixed] = async (root, args, options) => {
          return client.callTool(tool.name, args);
        };
      }
    }
    return handlers;
  }

  async shutdown() {
    const results = await Promise.allSettled(
      Array.from(this.clients.values()).map(c => c.shutdown())
    );
    this.clients.clear();
    this.schemas = [];
    this.handlers = {};
    return results;
  }

  getClient(serverName) {
    return this.clients.get(serverName);
  }

  getToolPolicy(serverName) {
    const config = this.mcpConfig.mcpServers?.[serverName];
    if (config?.toolPolicy) return config.toolPolicy;
    if (this.mcpConfig.defaults?.toolPolicy) return this.mcpConfig.defaults.toolPolicy;
    return 'ask';
  }

  async connectServer(name, config) {
    const defaults = this.mcpConfig.defaults || {};
    const client = new MCPClient(name, config, defaults);
    await client.initialize();
    const tools = await client.listTools();
    this.clients.set(name, client);
    this.schemas.push(...client.getToolSchemas());
    this.handlers = this._buildHandlers();
    return { tools, schemas: client.getToolSchemas() };
  }

  async disconnectServer(name) {
    const client = this.clients.get(name);
    if (!client) return;
    await client.shutdown().catch(() => {});
    this.clients.delete(name);
    this._rebuildSchemasAndHandlers();
  }

  _rebuildSchemasAndHandlers() {
    this.schemas = [];
    for (const [, client] of this.clients) {
      this.schemas.push(...client.getToolSchemas());
    }
    this.handlers = this._buildHandlers();
  }

  getStatus(name) {
    const client = this.clients.get(name);
    return {
      connected: !!client?.initialized,
      toolCount: client?.tools?.length || 0
    };
  }
}

function buildMcpToolBridge(mcpManager) {
  return {
    mcpToolSchemas: mcpManager.schemas,
    mcpToolHandlers: mcpManager.handlers
  };
}

module.exports = { convertInputSchema, MCPClient, MCPManager, buildMcpToolBridge };

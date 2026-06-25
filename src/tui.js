'use strict';

/**
 * TUI mode using blessed — Terminal User Interface for sicli
 * OpenCode-inspired: slash commands, clean footer, stable input handling.
 */

const blessed = require('blessed');
const { loadConfig, saveConfig, modelsForConfig, listPermissionModes } = require('./config');
const { listBuiltInProviders, getBuiltInProvider } = require('./provider-registry');
const { listSuperpowers, listPresets, applyPreset, isEnabled } = require('./superpowers');
const { loadMcpConfig, saveMcpConfig } = require('./state');
const { discoverSkills, enableSkill, disableSkill } = require('./skills');
const { loadProfiles } = require('./state');
const { hasProviderApiKey } = require('./secrets');
const { startChat } = require('./agent');
const { MODES, getDefaultMode, switchMode, getModeDisplay } = require('./modes');

class TUI {
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.screen = null;
    this.currentView = 'chat';
    this.chatHistory = [];
    this.config = null;
    this.running = false;
    this.currentMode = null;
    this.gitBranch = null;
    this.processing = false;
    this.uiMode = 'input'; // 'input' or 'modal'
  }

  async init() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'sicli — Self-Improving CLI',
      autoPadding: true,
      warnings: false,
      mouse: true,
    });

    this.config = await loadConfig(this.root);
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentTheme = this.options.theme || 'default';
    this.currentMode = getDefaultMode(this.config);
    this.gitBranch = await this.detectGitBranch();

    this.createLayout();
    this.bindKeys();
    this.updateHeader();
    this.applyTheme();
    this.log('Welcome to sicli TUI. Type /help for commands, Ctrl+C to exit.');
    this.screen.render();
  }

  // ─── Layout ───────────────────────────────────────────────────────

  createLayout() {
    // Header
    this.header = blessed.box({
      top: 0, left: 0, width: '100%', height: 3,
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'blue', border: { fg: '#8700af' } },
      content: '{center}sicli — Loading...{/center}',
    });
    this.screen.append(this.header);

    // Chat area
    this.chatBox = blessed.box({
      top: 3, left: 0, width: '100%', height: '100%-7',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { inverse: true } },
    });
    this.screen.append(this.chatBox);

    // Status bar — minimal, OpenCode-style
    this.statusBar = blessed.box({
      bottom: 3, left: 0, width: '100%', height: 1,
      tags: true,
      style: { fg: 'black', bg: 'green' },
      content: ' Enter: send | /help: commands | Tab: mode | ↑↓: history | Ctrl+C: quit',
    });
    this.screen.append(this.statusBar);

    // Input — use textbox (not textarea) for reliable Enter/submit behavior.
    // Do NOT set keys:true or vi:true — inputOnFocus already handles character input.
    this.inputBox = blessed.textbox({
      bottom: 0, left: 0, width: '100%', height: 3,
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      inputOnFocus: true,
      mouse: true,
    });
    this.screen.append(this.inputBox);

    // Click to focus
    this.chatBox.on('click', () => { this.chatBox.focus(); this.screen.render(); });
    this.inputBox.on('click', () => { this.inputBox.focus(); this.screen.render(); });
  }

  // ─── Key Bindings ─────────────────────────────────────────────────

  bindKeys() {
    // Ctrl+C always exits — no matter what mode
    this.screen.key(['C-c', 'C-x'], () => this.exit());

    // Enter → submit prompt.
    // Return true for ALL keys to prevent the textbox's internal inputOnFocus
    // handler from double-inserting characters.
    this.inputBox.on('keypress', (ch, key) => {
      // Block entirely when modal is open
      if (this.uiMode === 'modal') return true;

      if (key.name === 'enter' && !key.ctrl && !key.meta) {
        const input = this.inputBox.getValue().trim();
        this.inputBox.clearValue();
        this.inputBox.focus();
        this.screen.render();
        if (input) {
          this.submitInput(input);
        }
        return true; // swallow
      }
      if (key.name === 'escape') {
        this.inputBox.clearValue();
        this.screen.render();
        return true;
      }

      // For ALL other keys: return true to prevent double-insertion.
      // The textbox with inputOnFocus:true has already inserted the character.
      // If we let the event propagate, the textbox will insert it again.
      return true;
    });

    // History navigation — up/down when input is focused
    this.inputBox.key(['up'], () => {
      if (this.uiMode === 'modal') return;
      if (this.commandHistory.length === 0) return;
      if (this.historyIndex === -1) {
        this.historyIndex = this.commandHistory.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.inputBox.setValue(this.commandHistory[this.historyIndex] || '');
      this.screen.render();
    });

    this.inputBox.key(['down'], () => {
      if (this.uiMode === 'modal') return;
      if (this.historyIndex === -1) return;
      this.historyIndex++;
      if (this.historyIndex >= this.commandHistory.length) {
        this.historyIndex = -1;
        this.inputBox.clearValue();
      } else {
        this.inputBox.setValue(this.commandHistory[this.historyIndex] || '');
      }
      this.screen.render();
    });

    // Tab → cycle Plan/Build mode
    this.inputBox.key(['tab'], () => {
      if (this.uiMode === 'modal') return;
      this.toggleMode();
    });
  }

  // ─── Input Handling ───────────────────────────────────────────────

  async submitInput(input) {
    // Record history
    this.commandHistory.push(input);
    if (this.commandHistory.length > 200) this.commandHistory.shift();
    this.historyIndex = -1;

    // Shell command
    if (input.startsWith('!')) {
      await this.handleShellCommand(input.slice(1).trim());
      return;
    }

    // Slash command
    if (input.startsWith('/')) {
      await this.handleSlashCommand(input);
      return;
    }

    // @file / @agent handling
    if (input.includes('@')) {
      input = await this.resolveReferences(input);
    }

    // Regular chat — send to agent
    await this.handleChatMessage(input);
  }

  async handleChatMessage(input) {
    this.log(input, 'user');

    this.processing = true;
    this.statusBar.setContent(' {bold}Processing...{/bold} Ctrl+C to cancel');
    this.screen.render();

    try {
      const { runAgentTask } = require('./agent');
      const result = await runAgentTask(this.root, input, {
        interactive: false,
        yes: true,
        trace: false,
      });
      this.log(result.text || 'Task completed', 'agent');
    } catch (error) {
      this.log(error.message, 'error');
    }

    this.processing = false;
    this.statusBar.setContent(' Enter: send | /help: commands | Tab: mode | ↑↓: history | Ctrl+C: quit');
    this.screen.render();
  }

  async resolveReferences(input) {
    try {
      const { parseAgentMention } = require('./agents');
      const mention = parseAgentMention(input);
      if (mention.agent) {
        const { getAgent } = require('./agents');
        const agent = getAgent(mention.agent, this.config || {});
        if (agent) {
          this.log(`→ @${agent.name}: ${agent.description}`, 'info');
          this.currentMode = agent.mode;
          this.updateHeader();
          return mention.text;
        }
      }
      const { attachFileContent, formatAttachmentSummary } = require('./file-reference');
      const result = await attachFileContent(this.root, input);
      if (result.attached.length > 0 || result.missing.length > 0) {
        const summary = formatAttachmentSummary(result);
        if (summary) this.log(summary, 'info');
        return result.prompt;
      }
    } catch (_) { /* ignore */ }
    return input;
  }

  // ─── Slash Commands ───────────────────────────────────────────────

  async handleSlashCommand(input) {
    const [cmd, ...args] = input.slice(1).split(/\s+/);
    const action = cmd.toLowerCase();

    try {
      switch (action) {
        case 'help':       this.showHelp(); break;
        case 'clear':      this.clearChat(); break;
        case 'quit':
        case 'exit':       this.exit(); break;
        case 'status':     this.showStatus(); break;
        case 'provider':   this.showProviderMenu(); break;
        case 'providers':  this.showProviderMenu(); break;
        case 'models':     this.showModelsList(); break;
        case 'config':     this.showConfigMenu(); break;
        case 'mcp':        this.showMCPMenu(); break;
        case 'skills':     this.showSkillsMenu(); break;
        case 'powers':
        case 'superpowers': this.showSuperpowersMenu(); break;
        case 'swarm':      this.handleSwarmCommand(args); break;
        case 'theme':      this.showThemeMenu(); break;
        case 'export':     await this.handleExportCommand(args); break;
        case 'import':     await this.handleImportCommand(args); break;
        case 'history':    this.showHistory(); break;
        case 'mode':       this.handleModeCommand(args); break;
        case 'plan':       await this.switchToPlanMode(); break;
        case 'build':      await this.switchToBuildMode(); break;
        case 'undo':       await this.handleUndo(); break;
        case 'diagnostics':
        case 'diag':       this.showDiagnosticsMenu(); break;
        case 'sessions':
        case 'session':    this.showSessionsMenu(); break;
        case 'agent':
        case 'agents':     this.showAgentPicker(); break;
        default:
          await this.tryCustomCommand(action, args);
      }
    } catch (error) {
      this.log(error.message, 'error');
    }
    this.screen.render();
  }

  async tryCustomCommand(name, args) {
    try {
      const { loadCustomCommand, executeCustomCommand } = require('./commands/custom-commands');
      const command = await loadCustomCommand(this.root, name);
      if (!command) {
        this.log(`Unknown command: /${name}. Type /help for available commands.`, 'error');
        return;
      }

      this.log(`Running /${name}...`, 'info');
      const result = await executeCustomCommand(this.root, name, args);

      if (result.agent === 'plan' && this.currentMode !== 'plan') await this.switchToPlanMode();
      else if (result.agent === 'build' && this.currentMode !== 'build') await this.switchToBuildMode();

      this.statusBar.setContent(` {bold}Running /${name}...{/bold}`);
      this.screen.render();

      const { runAgentTask } = require('./agent');
      const taskResult = await runAgentTask(this.root, result.prompt, {
        interactive: false, yes: true, trace: false,
      });
      this.log(taskResult.text || `/${name} completed`, 'agent');
      this.statusBar.setContent(' Enter: send | /help: commands | Tab: mode | ↑↓: history | Ctrl+C: quit');
    } catch (error) {
      this.log(error.message, 'error');
    }
  }

  // ─── Command Implementations ──────────────────────────────────────

  clearChat() {
    this.chatHistory = [];
    this.chatBox.setContent('');
    this.log('Screen cleared.', 'info');
    this.screen.render();
  }

  showStatus() {
    const provider = this.config?.active_provider || 'unknown';
    const model = this.config?.active_model || 'unknown';
    const permMode = this.config?.permission_mode || 'unknown';
    const modeDisplay = getModeDisplay(this.currentMode);
    this.log(`Provider: ${provider}/${model}  Mode: ${modeDisplay.label}  Permission: ${permMode}  Branch: ${this.gitBranch || 'n/a'}`, 'info');
  }

  showHelp() {
    const lines = [
      '{bold}Slash Commands{/bold}',
      '  /help              Show this help',
      '  /clear             Clear conversation',
      '  /status            Show current provider/mode/status',
      '  /provider          Select provider',
      '  /providers         Same as /provider',
      '  /models            List available models',
      '  /config            Config menu (local/global)',
      '  /mcp               Manage MCP servers',
      '  /skills            Manage skills',
      '  /powers            Toggle superpowers',
      '  /theme             Change theme',
      '  /history           Show command history',
      '  /mode <plan|build> Switch mode',
      '  /plan              Switch to Plan mode',
      '  /build             Switch to Build mode',
      '  /sessions          Session management',
      '  /agents            Agent picker',
      '  /diagnostics       Run diagnostics',
      '  /undo              Undo last change (git)',
      '  /swarm <prompt>    Run swarm orchestration',
      '  /export [scope]    Export config (local/global/merged)',
      '  /import [scope]    Import config',
      '  /exit              Exit TUI',
      '  /quit              Same as /exit',
      '',
      '{bold}Shortcuts{/bold}',
      '  Enter      Send prompt / execute command',
      '  Tab        Cycle Plan/Build mode',
      '  ↑ / ↓      Navigate command history',
      '  Ctrl+C     Exit',
      '  Escape     Clear input / close dialog',
      '  !command   Run shell command (e.g., !git status)',
      '  @file      Attach file to context',
      '  @agent     Route to specific agent',
      '',
      '{bold}Tab completion{/bold}',
      '  Type /he<Tab> → /help',
    ];
    for (const line of lines) this.log(line, 'help');
  }

  showHistory() {
    if (this.commandHistory.length === 0) {
      this.log('No command history.', 'info');
      return;
    }
    this.log(`Command history (${this.commandHistory.length} entries):`, 'info');
    const start = Math.max(0, this.commandHistory.length - 20);
    for (let i = start; i < this.commandHistory.length; i++) {
      this.log(`  ${i + 1}. ${this.commandHistory[i]}`, 'info');
    }
  }

  showModelsList() {
    try {
      const models = modelsForConfig(this.config);
      if (models.length === 0) {
        this.log('No models available for current provider.', 'info');
        return;
      }
      this.log(`Available models (${models.length}):`, 'info');
      for (const m of models) {
        const active = m === this.config.active_model ? ' (active)' : '';
        this.log(`  ${m}${active}`, 'info');
      }
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
    }
  }

  handleSwarmCommand(args) {
    if (args.length === 0) {
      this.log('Usage: /swarm <prompt>', 'error');
      return;
    }
    const prompt = args.join(' ');
    this.log(`Swarm: ${prompt}`, 'info');
    this.handleChatMessage(prompt);
  }

  async handleExportCommand(args) {
    const scope = args[0] || 'merged';
    try {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const config = await loadConfig(this.root, { scope });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `sicli-config-${scope}-${timestamp}.json`;
      const filepath = path.join(this.root, filename);
      await fs.writeFile(filepath, JSON.stringify(config, null, 2));
      this.log(`Exported ${scope} config to ${filename}`, 'success');
    } catch (error) {
      this.log(`Export failed: ${error.message}`, 'error');
    }
  }

  async handleImportCommand(args) {
    const scope = args[0] || 'local';
    if (!args[1]) {
      this.log('Usage: /import <local|global> <filepath>', 'error');
      return;
    }
    try {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const fullPath = path.isAbsolute(args[1]) ? args[1] : path.join(this.root, args[1]);
      const content = await fs.readFile(fullPath, 'utf8');
      const importedConfig = JSON.parse(content);
      await saveConfig(this.root, importedConfig, { scope, backup: true });
      this.config = await loadConfig(this.root);
      this.updateHeader();
      this.log(`Imported config from ${args[1]}`, 'success');
    } catch (error) {
      this.log(`Import failed: ${error.message}`, 'error');
    }
  }

  // ─── Mode Management ──────────────────────────────────────────────

  async handleModeCommand(args) {
    const mode = args[0]?.toLowerCase();
    if (mode === 'plan') await this.switchToPlanMode();
    else if (mode === 'build') await this.switchToBuildMode();
    else this.log('Usage: /mode <plan|build>', 'error');
  }

  async switchToPlanMode() {
    this.currentMode = MODES.PLAN;
    const display = getModeDisplay(this.currentMode);
    this.log(`Switched to ${display.label} mode: ${display.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  async switchToBuildMode() {
    this.currentMode = MODES.BUILD;
    const display = getModeDisplay(this.currentMode);
    this.log(`Switched to ${display.label} mode: ${display.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  toggleMode() {
    const result = switchMode(this.currentMode);
    this.currentMode = result.mode;
    const display = getModeDisplay(this.currentMode);
    this.log(`Switched to ${display.label} mode: ${result.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  // ─── Undo ─────────────────────────────────────────────────────────

  async handleUndo() {
    try {
      const { undo, listSnapshots } = require('./snapshot');
      const snaps = await listSnapshots(this.root);
      if (snaps.length === 0) {
        this.log('No snapshots to undo.', 'info');
        return;
      }
      const result = await undo(this.root);
      if (result.ok) {
        this.log(result.message, 'success');
      } else {
        this.log(`Undo failed: ${result.error}`, 'error');
      }
    } catch (error) {
      this.log(`Undo error: ${error.message}`, 'error');
    }
    this.screen.render();
  }

  // ─── Shell Commands ───────────────────────────────────────────────

  async handleShellCommand(cmd) {
    if (!cmd) {
      this.log('Usage: !command [args...]', 'error');
      return;
    }
    this.log(`$ ${cmd}`, 'info');
    this.screen.render();

    try {
      const { execFile } = require('node:child_process');
      const parts = cmd.split(/\s+/);
      await new Promise((resolve, reject) => {
        execFile(parts[0], parts.slice(1), {
          cwd: this.root, timeout: 30000, maxBuffer: 1024 * 1024, shell: false,
        }, (error, stdout, stderr) => {
          if (stdout) this.log(stdout.trim().slice(0, 2000), 'info');
          if (stderr) this.log(stderr.trim().slice(0, 2000), error ? 'error' : 'info');
          if (error) reject(error); else resolve();
        });
      });
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'error');
    }
    this.screen.render();
  }

  // ─── Interactive Menus ────────────────────────────────────────────

  showProviderMenu() {
    const providers = listBuiltInProviders();
    const items = providers.map(p => {
      const active = p.id === this.config.active_provider ? ' [ACTIVE]' : '';
      const local = p.local ? ' (local)' : '';
      return `${p.label}${local}${active}`;
    });
    items.push('+ Add custom provider');
    items.push('Cancel');

    this.showList(' Select Provider ', items, async (index) => {
      if (index === items.length - 1) return;
      if (index === items.length - 2) { await this.addCustomProvider(); return; }
      const provider = providers[index];
      this.config.active_provider = provider.id;
      this.config.active_model = provider.default_model;
      if (!this.config.providers) this.config.providers = {};
      this.config.providers[provider.id] = { ...provider };
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.updateHeader();
      this.log(`Switched to ${provider.label} / ${provider.default_model}`, 'success');
    });
  }

  showModelsList() {
    try {
      const models = modelsForConfig(this.config);
      if (models.length === 0) { this.log('No models available.', 'info'); return; }
      const items = models.map(m => m === this.config.active_model ? `${m} [ACTIVE]` : m);
      items.push('Cancel');
      this.showList(' Select Model ', items, (index) => {
        if (index === items.length - 1) return;
        this.config.active_model = models[index];
        saveConfig(this.root, this.config, { scope: 'local' }).then(() => {
          this.updateHeader();
          this.log(`Switched model: ${models[index]}`, 'success');
          this.screen.render();
        });
      });
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
    }
  }

  async addCustomProvider() {
    this.showForm('Add Custom Provider', [
      { label: 'ID (unique):', name: 'id' },
      { label: 'Label:', name: 'label' },
      { label: 'Base URL:', name: 'base_url' },
      { label: 'API Key Env Var:', name: 'api_key_env' },
      { label: 'Models (comma-separated):', name: 'models' },
    ], async (data) => {
      if (!data.id || !data.base_url) {
        this.log('ID and Base URL are required', 'error');
        return;
      }
      const models = data.models ? data.models.split(',').map(m => m.trim()).filter(Boolean) : [];
      const { connectCustomProvider } = require('./config');
      await connectCustomProvider(this.root, {
        id: data.id, label: data.label, base_url: data.base_url,
        api_key_env: data.api_key_env, models: models.length > 0 ? models : undefined,
      }, { scope: 'local' });
      this.config = await loadConfig(this.root);
      this.updateHeader();
      this.log(`Added custom provider: ${data.label || data.id}`, 'success');
    });
  }

  showConfigMenu() {
    const items = ['View local config', 'View global config', 'Validate config', 'Cancel'];
    this.showList(' Config ', items, async (index) => {
      if (index === items.length - 1) return;
      try {
        if (index === 0) this.showJsonViewer('Local Config', await loadConfig(this.root, { scope: 'local' }));
        else if (index === 1) this.showJsonViewer('Global Config', await loadConfig(this.root, { scope: 'global' }));
        else if (index === 2) { await loadConfig(this.root); this.log('Config is valid.', 'success'); }
      } catch (error) {
        this.log(error.message, 'error');
      }
    });
  }

  showMCPMenu() {
    loadMcpConfig(this.root).then(mcpConfig => {
      const servers = Object.keys(mcpConfig.mcpServers || {});
      const items = [];
      if (servers.length > 0) {
        servers.forEach(s => {
          const cfg = mcpConfig.mcpServers[s];
          items.push(`${s} — ${cfg.command} (${cfg.args?.length || 0} args)`);
        });
      } else {
        items.push('No MCP servers configured');
      }
      items.push('---');
      items.push('+ Add MCP server');
      if (servers.length > 0) items.push('⟳ Reload MCP');
      items.push('Cancel');

      this.showList(' MCP Servers ', items, async (index) => {
        if (index === items.length - 1) return;
        const itemText = items[index];
        if (itemText === '+ Add MCP server') { await this.addMCPServer(); return; }
        if (itemText === '⟳ Reload MCP') { this.log('MCP reloaded.', 'success'); return; }
        if (index < servers.length) { this.showJsonViewer(`MCP: ${servers[index]}`, mcpConfig.mcpServers[servers[index]]); return; }
      });
    });
  }

  async addMCPServer() {
    this.showForm('Add MCP Server', [
      { label: 'Server Name:', name: 'name', placeholder: 'filesystem' },
      { label: 'Command:', name: 'command', placeholder: 'npx' },
      { label: 'Args (comma-separated):', name: 'args', placeholder: '@modelcontextprotocol/server-filesystem,/path' },
      { label: 'Env (KEY=VAL, comma):', name: 'env', placeholder: 'DEBUG=true' },
    ], async (data) => {
      if (!data.name || !data.command) { this.log('Name and command required.', 'error'); return; }
      const mcpConfig = await loadMcpConfig(this.root);
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      const args = data.args ? data.args.split(',').map(a => a.trim()).filter(Boolean) : [];
      const env = {};
      if (data.env) data.env.split(',').forEach(pair => { const [k, v] = pair.split('=').map(s => s.trim()); if (k && v) env[k] = v; });
      mcpConfig.mcpServers[data.name] = { command: data.command, args, env: Object.keys(env).length > 0 ? env : undefined };
      await saveMcpConfig(this.root, mcpConfig);
      this.log(`Added MCP server: ${data.name}`, 'success');
    });
  }

  async removeMCPServer(serverName) {
    try {
      const mcpConfig = await loadMcpConfig(this.root);
      if (mcpConfig.mcpServers && mcpConfig.mcpServers[serverName]) {
        delete mcpConfig.mcpServers[serverName];
        await saveMcpConfig(this.root, mcpConfig);
        this.log(`Removed MCP server: ${serverName}`, 'success');
      } else {
        this.log(`MCP server not found: ${serverName}`, 'error');
      }
    } catch (error) {
      this.log(`Remove failed: ${error.message}`, 'error');
    }
  }

  showSkillsMenu() {
    Promise.all([discoverSkills(this.root), loadProfiles(this.root)]).then(([skills, { active }]) => {
      const activeNames = active.memory?.active_skills || [];
      const items = skills.map(s => {
        const status = activeNames.includes(s.name) ? '[ENABLED]' : '[disabled]';
        return `${s.name} — ${s.description} ${status}`;
      });
      items.push('Cancel');
      this.showList(' Skills ', items, async (index) => {
        if (index === items.length - 1) return;
        const skill = skills[index];
        if (activeNames.includes(skill.name)) {
          await disableSkill(this.root, skill.name);
          this.log(`Disabled: ${skill.name}`, 'success');
        } else {
          await enableSkill(this.root, skill.name);
          this.log(`Enabled: ${skill.name}`, 'success');
        }
        this.screen.render();
      });
    });
  }

  showSuperpowersMenu() {
    const powers = listSuperpowers();
    const items = powers.map(p => {
      const enabled = isEnabled(this.config, p.name) ? '[ON]' : '[OFF]';
      return `${p.label} ${enabled} — ${p.description}`;
    });
    items.push('---');
    items.push('Preset: Safe', 'Preset: Balanced', 'Preset: Power');
    items.push('Cancel');

    this.showList(' Superpowers ', items, async (index) => {
      if (index === items.length - 1) return;
      if (index === powers.length + 1) { this.applyPreset('safe'); return; }
      if (index === powers.length + 2) { this.applyPreset('balanced'); return; }
      if (index === powers.length + 3) { this.applyPreset('power'); return; }
      if (index === powers.length) return;
      const power = powers[index];
      if (!this.config.superpowers) this.config.superpowers = {};
      this.config.superpowers[power.name] = !isEnabled(this.config, power.name);
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.log(`Toggled ${power.name}: ${this.config.superpowers[power.name] ? 'ON' : 'OFF'}`, 'success');
      this.screen.render();
    });
  }

  async applyPreset(name) {
    this.config.superpowers = applyPreset(name);
    await saveConfig(this.root, this.config, { scope: 'local' });
    this.log(`Applied preset: ${name}`, 'success');
    this.screen.render();
  }

  showThemeMenu() {
    const themes = this.getThemes();
    const names = Object.keys(themes);
    const items = names.map(n => n === this.currentTheme ? `${n} [ACTIVE]` : n);
    items.push('Cancel');
    this.showList(' Theme ', items, async (index) => {
      if (index === items.length - 1) return;
      this.currentTheme = names[index];
      this.applyTheme();
      this.config.tui_theme = this.currentTheme;
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.log(`Theme: ${this.currentTheme}`, 'success');
      this.screen.render();
    });
  }

  showSessionsMenu() {
    const { listSessions, createSession, loadSession, deleteSession, exportToMarkdown, getActiveSessionId, setActiveSessionId } = require('./sessions');
    Promise.all([listSessions(this.root), getActiveSessionId(this.root)]).then(([sessions, activeId]) => {
      const items = [
        '+ New Session',
        ...sessions.map(s => {
          const active = s.id === activeId ? ' [ACTIVE]' : '';
          return `${s.title}${active} (${s.messageCount} msgs)`;
        }),
        'Export Active Session',
        'Cancel',
      ];
      this.showList(' Sessions ', items, async (index) => {
        if (index === items.length - 1) return;
        if (index === 0) {
          const session = await createSession(this.root, {
            title: `Session ${new Date().toLocaleString()}`,
            mode: this.currentMode, provider: this.config?.active_provider, model: this.config?.active_model,
          });
          await setActiveSessionId(this.root, session.id);
          this.log(`Created session: ${session.title}`, 'success');
          return;
        }
        if (index === sessions.length + 1) {
          if (!activeId) { this.log('No active session.', 'error'); return; }
          try {
            const md = await exportToMarkdown(this.root, activeId);
            const fs = require('node:fs/promises');
            const path = require('node:path');
            const fname = `session-${activeId}-${Date.now()}.md`;
            await fs.writeFile(path.join(this.root, fname), md);
            this.log(`Exported to ${fname}`, 'success');
          } catch (e) { this.log(`Export failed: ${e.message}`, 'error'); }
          return;
        }
        // Resume
        const session = sessions[index - 1];
        await setActiveSessionId(this.root, session.id);
        const loaded = await loadSession(this.root, session.id);
        if (loaded?.messages) {
          this.chatHistory = [];
          for (const msg of loaded.messages) this.log(msg.content, msg.role === 'user' ? 'user' : 'agent');
        }
        this.log(`Resumed: ${session.title}`, 'success');
      });
    });
  }

  showDiagnosticsMenu() {
    this.showList(' Diagnostics ', ['Run Tests (npm test)', 'Cancel'], async (index) => {
      if (index === 1) return;
      this.log('Running npm test...', 'info');
      this.screen.render();
      try {
        const { runTests, formatDiagnostics } = require('./diagnostics');
        const result = await runTests(this.root);
        this.log(formatDiagnostics(result.diagnostics), result.passed ? 'success' : 'error');
      } catch (e) { this.log(`Error: ${e.message}`, 'error'); }
    });
  }

  showAgentPicker() {
    try {
      const { listAllAgents } = require('./agents');
      const agents = listAllAgents(this.config || {});
      const items = agents.map(a => `${a.name.padEnd(12)} [${a.mode.toUpperCase()}]  ${a.description}`);
      items.push('Cancel');
      this.showList(' Agent Picker ', items, (index) => {
        if (index === items.length - 1) return;
        const agent = agents[index];
        this.currentMode = agent.mode;
        this.updateHeader();
        this.log(`Switched to @${agent.name}: ${agent.description}`, 'success');
        this.screen.render();
      });
    } catch (e) {
      this.log(`Agent error: ${e.message}`, 'error');
    }
  }

  showPermissionPanel() {
    const currentMode = this.config?.permission_mode || 'unknown';
    const modes = listPermissionModes();
    const lines = [
      `{bold}Current Permission Mode: {green-fg}${currentMode}{/green-fg}{/bold}`,
      '',
      '{bold}Available Modes:{/bold}',
      ...modes.map(m => {
        const desc = m === 'secure' ? 'Most restrictive — all edits require approval' :
                     m === 'partial_secure' ? 'Read/append allowed, edits require approval' :
                     m === 'ai_reviewed' ? 'AI reviews decisions, asks for high-risk' :
                     m === 'auto_approve' ? 'All actions auto-approved (use with caution)' : '';
        return `  ${m === currentMode ? '→' : ' '} ${m}: ${desc}`;
      }),
    ];
    for (const line of lines) this.log(line, 'help');
  }

  // ─── Shared UI Helpers ────────────────────────────────────────────

  showList(label, items, onSelect) {
    this.uiMode = 'modal'; // block input handler

    const list = blessed.list({
      parent: this.screen,
      top: 'center', left: 'center', width: '70%', height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ` ${label} `,
      keys: true, vi: true, mouse: true, items,
    });

    const closeModal = () => {
      list.destroy();
      this.uiMode = 'input'; // restore input mode
      this.inputBox.clearValue();
      this.inputBox.focus();
      this.screen.render();
    };

    list.on('select', async (_item, index) => {
      closeModal();
      await onSelect(index);
    });

    list.focus();
    this.screen.render();

    // Escape closes modal
    list.key(['escape'], () => { closeModal(); });
  }

  showForm(label, fields, onSubmit) {
    this.uiMode = 'modal'; // block input handler

    const form = blessed.form({
      parent: this.screen,
      top: 'center', left: 'center', width: '70%', height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ` ${label} `,
      keys: true, mouse: true,
    });
    let top = 2;
    for (const field of fields) {
      blessed.text({ parent: form, top, left: 2, content: field.label, style: { fg: 'white' } });
      const tb = blessed.textbox({
        parent: form, top: top + 1, left: 2, width: '90%', height: 3,
        border: { type: 'line' },
        style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
        inputOnFocus: true, name: field.name, mouse: true,
      });
      if (field.placeholder) tb.setValue(field.placeholder);
      top += 5;
    }
    const submitBtn = blessed.button({
      parent: form, top, left: 2, width: 20, height: 3,
      content: 'Save', border: { type: 'line' },
      style: { fg: 'black', bg: 'green', border: { fg: '#8700af' } }, mouse: true,
    });
    const cancelBtn = blessed.button({
      parent: form, top, left: 25, width: 20, height: 3,
      content: 'Cancel', border: { type: 'line' },
      style: { fg: 'black', bg: 'red', border: { fg: '#8700af' } }, mouse: true,
    });
    const closeForm = () => {
      form.destroy();
      this.uiMode = 'input';
      this.inputBox.focus();
      this.screen.render();
    };

    submitBtn.on('press', async () => {
      const data = {};
      for (const field of fields) {
        const tb = form.children.find(c => c.name === field.name);
        data[field.name] = tb?.getValue()?.trim() || '';
      }
      closeForm();
      await onSubmit(data);
    });
    cancelBtn.on('press', () => { closeForm(); });
    form.focus();
    form.key(['escape'], () => { closeForm(); });
  }

  showJsonViewer(title, data) {
    this.uiMode = 'modal'; // block input handler

    const viewer = blessed.box({
      parent: this.screen,
      top: 'center', left: 'center', width: '80%', height: '80%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ` ${title} `,
      scrollable: true, alwaysScroll: true, keys: true, vi: true,
      content: JSON.stringify(data, null, 2),
    });
    viewer.focus();
    const closeViewer = () => {
      viewer.destroy();
      this.uiMode = 'input';
      this.inputBox.focus();
      this.screen.render();
    };
    viewer.key(['escape'], () => { closeViewer(); });
  }

  // ─── Tab Completion ───────────────────────────────────────────────

  getTabCompletion(input) {
    const commands = [
      '/help', '/clear', '/status', '/provider', '/models', '/config', '/mcp',
      '/skills', '/powers', '/theme', '/history', '/mode', '/plan', '/build',
      '/sessions', '/agents', '/diagnostics', '/undo', '/swarm', '/export',
      '/import', '/exit', '/quit',
    ];
    if (!input.startsWith('/')) return null;
    const matches = commands.filter(c => c.startsWith(input));
    if (matches.length === 1) return matches[0] + ' ';
    if (matches.length > 1) this.log(`Completions: ${matches.join(', ')}`, 'info');
    return null;
  }

  // ─── Theme ────────────────────────────────────────────────────────

  getThemes() {
    return {
      default: {
        header: { fg: 'white', bg: 'blue', border: '#8700af' },
        chat: { fg: 'white', bg: 'black', border: '#8700af' },
        input: { fg: 'white', bg: 'black', border: '#8700af' },
        status: { fg: 'black', bg: 'green' },
      },
      dark: {
        header: { fg: 'white', bg: '#1a1a1a', border: '#444' },
        chat: { fg: '#ddd', bg: '#0a0a0a', border: '#444' },
        input: { fg: '#ddd', bg: '#0a0a0a', border: '#444' },
        status: { fg: 'white', bg: '#222' },
      },
      light: {
        header: { fg: 'black', bg: '#e0e0e0', border: '#999' },
        chat: { fg: 'black', bg: 'white', border: '#999' },
        input: { fg: 'black', bg: 'white', border: '#999' },
        status: { fg: 'black', bg: '#d0d0d0' },
      },
      ocean: {
        header: { fg: 'white', bg: '#004d7a', border: '#0080c0' },
        chat: { fg: '#e0f7ff', bg: '#001a33', border: '#0080c0' },
        input: { fg: '#e0f7ff', bg: '#001a33', border: '#0080c0' },
        status: { fg: 'white', bg: '#006699' },
      },
      matrix: {
        header: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        chat: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        input: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        status: { fg: 'black', bg: '#00ff00' },
      },
    };
  }

  applyTheme() {
    const themes = this.getThemes();
    const theme = themes[this.currentTheme] || themes.default;
    this.header.style.fg = theme.header.fg;
    this.header.style.bg = theme.header.bg;
    this.header.style.border.fg = theme.header.border;
    this.chatBox.style.fg = theme.chat.fg;
    this.chatBox.style.bg = theme.chat.bg;
    this.chatBox.style.border.fg = theme.chat.border;
    this.inputBox.style.fg = theme.input.fg;
    this.inputBox.style.bg = theme.input.bg;
    this.inputBox.style.border.fg = theme.input.border;
    this.statusBar.style.fg = theme.status.fg;
    this.statusBar.style.bg = theme.status.bg;
    this.screen.render();
  }

  // ─── Core Utilities ───────────────────────────────────────────────

  async detectGitBranch() {
    try {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const content = await fs.readFile(path.join(this.root, '.git', 'HEAD'), 'utf8');
      const match = content.match(/ref: refs\/heads\/(.+)/);
      return match ? match[1].trim() : 'detached';
    } catch { return null; }
  }

  updateHeader() {
    const provider = this.config?.active_provider || 'unknown';
    const model = this.config?.active_model || 'unknown';
    const permMode = this.config?.permission_mode || 'unknown';
    const cwd = process.cwd().split(/[\\/]/).pop() || process.cwd();
    const modeDisplay = getModeDisplay(this.currentMode);
    const gitPart = this.gitBranch ? ` [${this.gitBranch}]` : '';
    this.header.setContent(
      `{center}{bold}sicli{/bold} | ${cwd}${gitPart} | ${provider}/${model} | {${modeDisplay.color}-fg}${modeDisplay.label}{/${modeDisplay.color}-fg} | ${permMode}{/center}`
    );
  }

  log(message, type = 'info') {
    const ts = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '{red-fg}ERR{/red-fg}' :
                   type === 'success' ? '{green-fg}OK{/green-fg}' :
                   type === 'user' ? '{cyan-fg}You{/cyan-fg}' :
                   type === 'agent' ? '{yellow-fg}Agent{/yellow-fg}' :
                   type === 'help' ? '' :
                   '{gray-fg}INFO{/gray-fg}';
    const line = prefix ? `{gray-fg}${ts}{/gray-fg} ${prefix}: ${message}` : message;
    this.chatHistory.push(line);
    // Cap chat history at 1000 lines to prevent memory bloat
    if (this.chatHistory.length > 1000) this.chatHistory.shift();
    this.chatBox.setContent(this.chatHistory.join('\n'));
    this.chatBox.setScrollPerc(100);
  }

  switchToChat() {
    this.currentView = 'chat';
    this.updateHeader();
    this.screen.render();
  }

  async run() {
    this.running = true;
    this.inputBox.focus();
    this.screen.render();
    await new Promise(resolve => { this.screen.once('destroy', resolve); });
  }

  exit() {
    this.running = false;
    this.screen.destroy();
    process.exit(0);
  }
}

async function startTUI(root, options = {}) {
  const tui = new TUI(root, options);
  await tui.init();
  await tui.run();
}

module.exports = { TUI, startTUI };

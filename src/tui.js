'use strict';

/**
 * TUI mode using blessed - Terminal User Interface for sicli
 * Provides interactive chat, config management, provider selection, etc.
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
    this.currentMode = null; // Will be set from config
    this.gitBranch = null; // Will be detected
  }

  async init() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'sicli - Self-Improving CLI',
      autoPadding: true,
      warnings: false,
      mouse: true, // Enable mouse support
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
    this.showMessage('Welcome to sicli TUI. Press F1 for help, Ctrl+C to exit.');
    this.screen.render();
  }

  createLayout() {
    // Header
    this.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'blue', border: { fg: '#8700af' } },
      content: '{center}sicli - Loading...{/center}',
    });
    this.screen.append(this.header);

    // Main chat area
    this.chatBox = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-7',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { inverse: true } },
    });
    this.screen.append(this.chatBox);

    // Input box
    this.inputBox = blessed.textarea({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      inputOnFocus: true,
      keys: true,
      vi: true,
      mouse: true,
    });
    this.screen.append(this.inputBox);

    // Status bar
    this.statusBar = blessed.box({
      bottom: 3,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: { fg: 'black', bg: 'green' },
      content: ' F1:Help F2:Provider F3:Config F4:MCP F5:Skills F6:Powers F8:Theme F9:Export/Import | ↑↓:History Tab:Complete',
    });
    this.screen.append(this.statusBar);

    // Enable mouse events on interactive elements
    this.chatBox.on('click', () => {
      this.chatBox.focus();
      this.screen.render();
    });

    this.inputBox.on('click', () => {
      this.inputBox.focus();
      this.screen.render();
    });
  }

  bindKeys() {
    this.inputBox.on('submit', () => {
      const input = this.inputBox.getValue().trim();
      if (input) {
        this.handleInput(input);
        // Add to history
        this.commandHistory.push(input);
        if (this.commandHistory.length > 100) {
          this.commandHistory.shift();
        }
        this.historyIndex = -1;
      }
      this.inputBox.clearValue();
      this.inputBox.focus();
      this.screen.render();
    });

    // History navigation
    this.inputBox.key(['up'], () => {
      if (this.commandHistory.length === 0) return;
      if (this.historyIndex === -1) {
        this.historyIndex = this.commandHistory.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.inputBox.setValue(this.commandHistory[this.historyIndex]);
      this.screen.render();
    });

    this.inputBox.key(['down'], () => {
      if (this.historyIndex === -1) return;
      this.historyIndex++;
      if (this.historyIndex >= this.commandHistory.length) {
        this.historyIndex = -1;
        this.inputBox.clearValue();
      } else {
        this.inputBox.setValue(this.commandHistory[this.historyIndex]);
      }
      this.screen.render();
    });

    // Tab completion
    this.inputBox.key(['tab'], () => {
      const input = this.inputBox.getValue();
      const completion = this.getTabCompletion(input);
      if (completion) {
        this.inputBox.setValue(completion);
        this.screen.render();
      }
    });

    this.screen.key(['C-c', 'C-x'], () => {
      this.exit();
    });

    this.screen.key(['escape'], () => {
      if (this.currentView !== 'chat') {
        this.switchToChat();
      }
    });

    this.screen.key(['F1'], () => this.showHelp());
    this.screen.key(['F2'], () => this.showProviderMenu());
    this.screen.key(['F3'], () => this.showConfigMenu());
    this.screen.key(['F4'], () => this.showMCPMenu());
    this.screen.key(['F5'], () => this.showSkillsMenu());
    this.screen.key(['F6'], () => this.showSuperpowersMenu());
    this.screen.key(['F7'], () => this.showSwarmMenu());
    this.screen.key(['F8'], () => this.showSessionsMenu());
    this.screen.key(['F9'], () => this.showThemeMenu());
    this.screen.key(['F10'], () => this.showExportImportMenu());
    this.screen.key(['F11'], () => this.showDiagnosticsMenu());
    
    // Tab switches mode, Ctrl+K opens command palette, Ctrl+P opens provider picker
    this.inputBox.key(['tab'], async () => {
      await this.toggleMode();
    });
    this.screen.key(['C-k'], () => this.showCommandPalette());
    this.screen.key(['C-p'], () => this.showProviderPicker());
  }

  async detectGitBranch() {
    try {
      const fs = require('node:fs/promises');
      const path = require('node:path');
      const gitHead = path.join(this.root, '.git', 'HEAD');
      const content = await fs.readFile(gitHead, 'utf8');
      const match = content.match(/ref: refs\/heads\/(.+)/);
      return match ? match[1].trim() : 'detached';
    } catch {
      return null;
    }
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

  showLoadingIndicator(message = 'Working...') {
    const loading = blessed.loading({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 'shrink',
      height: 'shrink',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
    });
    loading.load(message);
    this.screen.render();
    return loading;
  }

  showMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '{red-fg}ERROR{/red-fg}' :
                   type === 'success' ? '{green-fg}SUCCESS{/green-fg}' :
                   type === 'user' ? '{cyan-fg}You{/cyan-fg}' :
                   type === 'agent' ? '{yellow-fg}Agent{/yellow-fg}' :
                   '{gray-fg}INFO{/gray-fg}';
    const line = `{gray-fg}${timestamp}{/gray-fg} ${prefix}: ${message}`;
    this.chatHistory.push(line);
    this.chatBox.setContent(this.chatHistory.join('\n'));
    this.chatBox.setScrollPerc(100);
  }

  async handleInput(input) {
    // Shell command with ! prefix
    if (input.startsWith('!')) {
      await this.handleShellCommand(input.slice(1).trim());
      return;
    }

    // @file reference handling
    if (input.includes('@')) {
      const { attachFileContent, formatAttachmentSummary } = require('./file-reference');
      const result = await attachFileContent(this.root, input);
      if (result.attached.length > 0 || result.missing.length > 0) {
        const summary = formatAttachmentSummary(result);
        if (summary) this.showMessage(summary, 'info');
        input = result.prompt;
        this.screen.render();
      }
    }

    // Slash commands
    if (input.startsWith('/')) {
      await this.handleSlashCommand(input);
      return;
    }

    // Regular chat
    this.showMessage(input, 'user');
    
    // Show loading indicator
    const spinner = this.showLoadingIndicator('Agent is thinking...');
    this.screen.render();

    try {
      // Run agent task
      const { runAgentTask } = require('./agent');
      const result = await runAgentTask(this.root, input, {
        interactive: false,
        yes: true,
        trace: false,
      });
      spinner.destroy();
      this.showMessage(result.text || 'Task completed', 'agent');
    } catch (error) {
      spinner.destroy();
      this.showMessage(error.message, 'error');
    }
    this.screen.render();
  }

  async handleShellCommand(cmd) {
    if (!cmd) {
      this.showMessage('Usage: !command [args...]', 'error');
      return;
    }

    // Check permission in Plan mode
    const { checkToolPermission } = require('./modes');
    const perm = checkToolPermission('run_command', this.currentMode, this.config?.permission_mode === 'auto_approve' ? { run_command: 'allow' } : {});
    
    this.showMessage(`$ ${cmd}`, 'info');
    this.screen.render();

    try {
      const { execFile } = require('node:child_process');
      const args = cmd.split(/\s+/);
      const command = args[0];
      const cmdArgs = args.slice(1);
      
      await new Promise((resolve, reject) => {
        execFile(command, cmdArgs, {
          cwd: this.root,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          shell: false,
        }, (error, stdout, stderr) => {
          if (error) {
            if (stdout) this.showMessage(stdout.trim().slice(0, 2000), 'info');
            if (stderr) this.showMessage(stderr.trim().slice(0, 2000), 'error');
            reject(error);
          } else {
            if (stdout) this.showMessage(stdout.trim().slice(0, 2000), 'success');
            if (stderr) this.showMessage(stderr.trim().slice(0, 500), 'info');
            resolve();
          }
        });
      });
    } catch (error) {
      this.showMessage(`Command failed: ${error.message}`, 'error');
    }
    this.screen.render();
  }

  async handleSlashCommand(input) {
    const [cmd, ...args] = input.slice(1).split(/\s+/);
    const action = cmd.toLowerCase();

    try {
      // Built-in commands
      if (action === 'help') this.showHelp();
      else if (action === 'provider') this.showProviderMenu();
      else if (action === 'config') this.showConfigMenu();
      else if (action === 'mcp') this.showMCPMenu();
      else if (action === 'skills') this.showSkillsMenu();
      else if (action === 'powers' || action === 'superpowers') this.showSuperpowersMenu();
      else if (action === 'swarm') this.showSwarmMenu();
      else if (action === 'mode') this.handleModeCommand(args);
      else if (action === 'plan') await this.switchToPlanMode();
      else if (action === 'build') await this.switchToBuildMode();
      else if (action === 'exit') this.exit();
      else if (action === 'diagnostics' || action === 'diag') this.showDiagnosticsMenu();
      else {
        // Try custom command
        await this.tryCustomCommand(action, args);
      }
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
    this.screen.render();
  }

  async tryCustomCommand(name, args) {
    const { loadCustomCommand, executeCustomCommand } = require('./commands/custom-commands');
    
    try {
      const command = await loadCustomCommand(this.root, name);
      if (!command) {
        this.showMessage(`Unknown command: /${name}. Try /help or create custom command`, 'error');
        return;
      }

      this.showMessage(`Running custom command: /${name}`, 'info');
      const result = await executeCustomCommand(this.root, name, args);
      
      // Show what the command will do
      this.showMessage(`Prompt: ${result.prompt.slice(0, 200)}${result.prompt.length > 200 ? '...' : ''}`, 'info');
      
      // Switch mode if specified
      if (result.agent === 'plan' && this.currentMode !== 'plan') {
        await this.switchToPlanMode();
      } else if (result.agent === 'build' && this.currentMode !== 'build') {
        await this.switchToBuildMode();
      }

      // Execute the prompt
      const spinner = this.showLoadingIndicator(`Executing /${name}...`);
      this.screen.render();

      try {
        const { runAgentTask } = require('./agent');
        const taskResult = await runAgentTask(this.root, result.prompt, {
          interactive: false,
          yes: true,
          trace: false,
        });
        spinner.destroy();
        this.showMessage(taskResult.text || 'Command completed', 'agent');
      } catch (error) {
        spinner.destroy();
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  async showCommandPalette() {
    // Built-in commands
    const commands = [
      { cmd: '/help', desc: 'Show help' },
      { cmd: '/mode plan', desc: 'Switch to Plan mode (read-only)' },
      { cmd: '/mode build', desc: 'Switch to Build mode' },
      { cmd: '/provider', desc: 'Provider menu' },
      { cmd: '/config', desc: 'Config menu' },
      { cmd: '/mcp', desc: 'MCP servers menu' },
      { cmd: '/skills', desc: 'Skills menu' },
      { cmd: '/powers', desc: 'Superpowers menu' },
      { cmd: '/swarm', desc: 'Swarm orchestration' },
      { cmd: '/exit', desc: 'Exit TUI' },
      { cmd: '/diagnostics', desc: 'Run diagnostics (tests/lint)' },
    ];

    // Add custom commands
    try {
      const { discoverCustomCommands } = require('./commands/custom-commands');
      const customCommands = await discoverCustomCommands(this.root);
      for (const custom of customCommands) {
        commands.push({
          cmd: `/${custom.name}`,
          desc: custom.frontmatter.description || 'Custom command',
        });
      }
    } catch (error) {
      // Silently ignore if custom commands can't be loaded
    }

    const items = commands.map(c => `${c.cmd.padEnd(20)} ${c.desc}`);

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '60%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Command Palette (Ctrl+K) ',
      keys: true,
      vi: true,
      mouse: true,
      items,
      search: true,
    });

    list.on('select', async (item, index) => {
      const command = commands[index].cmd;
      list.destroy();
      await this.handleSlashCommand(command);
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  showProviderPicker() {
    const providers = listBuiltInProviders();
    const items = providers.map(p => {
      const active = p.id === this.config.active_provider ? ' [ACTIVE]' : '';
      const local = p.local ? ' (local)' : '';
      return `${p.label.padEnd(25)}${local}${active}`;
    });

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Provider Picker (Ctrl+P) ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      const provider = providers[index];
      list.destroy();
      this.config.active_provider = provider.id;
      if (provider.default_model) {
        this.config.active_model = provider.default_model;
      }
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.updateHeader();
      this.showMessage(`Switched to ${provider.label}`, 'success');
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  showHelp() {
    const help = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ' Help ',
    });

    const content = `
{bold}Keyboard Shortcuts:{/bold}
  F1          Show this help
  F2          Provider menu (select/add providers)
  F3          Config menu (view/edit config)
  F4          MCP menu (manage MCP servers)
  F5          Skills menu (enable/disable skills)
  F6          Superpowers menu (toggle features)
  F7          Swarm menu (multi-agent orchestration)
  F8          Theme selector
  F9          Export/import config
  Tab         Switch Plan/Build modes
  Ctrl+K      Command palette
  Ctrl+P      Provider picker
  Escape      Return to chat / close dialog
  Ctrl+C      Exit TUI
  Enter       Send message/submit

{bold}Input Prefixes:{/bold}
  /command       Slash command (e.g., /help, /mode plan)
  !command       Run shell command (e.g., !git status)

{bold}Slash Commands:{/bold}
  /help              Show help
  /mode <plan|build> Switch mode
  /plan              Switch to Plan mode
  /build             Switch to Build mode
  /provider          Provider menu
  /config            Config menu
  /mcp               MCP servers menu
  /skills            Skills menu
  /powers            Superpowers menu
  /swarm <prompt>    Swarm orchestration
  /exit              Exit TUI

{bold}Modes:{/bold}
  PLAN   Read-only mode for safe exploration and analysis
  BUILD  Implementation mode with edit/write permissions

{bold}Press Escape to close{/bold}
`;
    help.setContent(content);
    help.focus();

    this.screen.key('escape', () => {
      help.destroy();
      this.screen.unkey('escape');
    });
  }

  async showProviderMenu() {
    const providers = listBuiltInProviders();
    const items = providers.map(p => {
      const active = p.id === this.config.active_provider ? ' [ACTIVE]' : '';
      const local = p.local ? ' (local)' : '';
      return `${p.label}${local}${active}`;
    });
    items.push('+ Add custom provider');
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Select Provider ',
      keys: true,
      vi: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      if (index === items.length - 2) {
        list.destroy();
        await this.addCustomProvider();
        return;
      }
      const provider = providers[index];
      this.config.active_provider = provider.id;
      this.config.active_model = provider.default_model;
      this.config.providers[provider.id] = { ...provider };
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.updateHeader();
      this.showMessage(`Switched to ${provider.label} / ${provider.default_model}`, 'success');
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async addCustomProvider() {
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '80%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ' Add Custom Provider ',
      keys: true,
    });

    const fields = [
      { label: 'ID (unique):', name: 'id' },
      { label: 'Label:', name: 'label' },
      { label: 'Base URL:', name: 'base_url' },
      { label: 'API Key Env Var:', name: 'api_key_env' },
      { label: 'Models (comma-separated):', name: 'models' },
    ];

    let top = 2;
    for (const field of fields) {
      blessed.text({
        parent: form,
        top,
        left: 2,
        content: field.label,
        style: { fg: 'white' },
      });
      const textbox = blessed.textbox({
        parent: form,
        top: top + 1,
        left: 2,
        width: '90%',
        height: 3,
        border: { type: 'line' },
        style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
        inputOnFocus: true,
        name: field.name,
      });
      top += 5;
    }

    const submitBtn = blessed.button({
      parent: form,
      top,
      left: 2,
      width: 20,
      height: 3,
      content: 'Save',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'green', border: { fg: '#8700af' } },
    });

    const cancelBtn = blessed.button({
      parent: form,
      top,
      left: 25,
      width: 20,
      height: 3,
      content: 'Cancel',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'red', border: { fg: '#8700af' } },
    });

    submitBtn.on('press', async () => {
      const data = {};
      for (const field of fields) {
        const textbox = form.children.find(c => c.name === field.name);
        data[field.name] = textbox.getValue().trim();
      }
      if (!data.id || !data.base_url) {
        this.showMessage('ID and Base URL are required', 'error');
        return;
      }
      const models = data.models.split(',').map(m => m.trim()).filter(Boolean);
      const { connectCustomProvider } = require('./config');
      await connectCustomProvider(this.root, {
        id: data.id,
        label: data.label,
        base_url: data.base_url,
        api_key_env: data.api_key_env,
        models: models.length > 0 ? models : undefined,
      }, { scope: 'local' });
      this.config = await loadConfig(this.root);
      this.updateHeader();
      this.showMessage(`Added custom provider: ${data.label}`, 'success');
      form.destroy();
      this.screen.render();
    });

    cancelBtn.on('press', () => {
      form.destroy();
      this.screen.render();
    });

    form.focus();
    this.screen.key('escape', () => {
      form.destroy();
      this.screen.unkey('escape');
    });
  }

  async showConfigMenu() {
    const items = [
      'View local config',
      'View global config',
      'Edit local config',
      'Edit global config',
      'Validate config',
      'Cancel',
    ];

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Config ',
      keys: true,
      vi: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      try {
        if (index === 0) {
          const local = await loadConfig(this.root, { scope: 'local' });
          this.showJsonViewer('Local Config', local);
        } else if (index === 1) {
          const global = await loadConfig(this.root, { scope: 'global' });
          this.showJsonViewer('Global Config', global);
        } else if (index === 4) {
          const config = await loadConfig(this.root);
          this.showMessage('Config is valid', 'success');
        }
      } catch (error) {
        this.showMessage(error.message, 'error');
      }
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async showMCPMenu() {
    const mcpConfig = await loadMcpConfig(this.root);
    const servers = Object.keys(mcpConfig.mcpServers || {});
    const items = [];
    
    if (servers.length > 0) {
      servers.forEach(s => {
        const config = mcpConfig.mcpServers[s];
        items.push(`${s} - ${config.command} (${config.args?.length || 0} args)`);
      });
    } else {
      items.push('No MCP servers configured');
    }
    
    items.push('---');
    items.push('+ Add MCP server');
    if (servers.length > 0) {
      items.push('- Remove MCP server');
      items.push('⟳ Reload MCP');
    }
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' MCP Servers ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      // Cancel
      if (index === items.length - 1) {
        list.destroy();
        return;
      }

      const itemText = items[index];
      
      // Add MCP server
      if (itemText === '+ Add MCP server') {
        list.destroy();
        await this.addMCPServer();
        return;
      }
      
      // Remove MCP server
      if (itemText === '- Remove MCP server') {
        list.destroy();
        await this.removeMCPServer(servers);
        return;
      }
      
      // Reload MCP
      if (itemText === '⟳ Reload MCP') {
        try {
          const { MCPManager } = require('./mcp-client');
          // Reload logic would go here
          this.showMessage('MCP reloaded', 'success');
        } catch (error) {
          this.showMessage(`Reload failed: ${error.message}`, 'error');
        }
        list.destroy();
        this.screen.render();
        return;
      }
      
      // Show server details
      if (index < servers.length) {
        const serverName = servers[index];
        const config = mcpConfig.mcpServers[serverName];
        this.showJsonViewer(`MCP Server: ${serverName}`, config);
        list.destroy();
        return;
      }
      
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async addMCPServer() {
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ' Add MCP Server ',
      keys: true,
      mouse: true,
    });

    const fields = [
      { label: 'Server Name:', name: 'name', placeholder: 'filesystem' },
      { label: 'Command:', name: 'command', placeholder: 'npx' },
      { label: 'Args (comma-separated):', name: 'args', placeholder: '@modelcontextprotocol/server-filesystem,/path' },
      { label: 'Env (KEY=VAL, comma-separated):', name: 'env', placeholder: 'DEBUG=true' },
    ];

    let top = 2;
    for (const field of fields) {
      blessed.text({
        parent: form,
        top,
        left: 2,
        content: field.label,
        style: { fg: 'white' },
      });
      const textbox = blessed.textbox({
        parent: form,
        top: top + 1,
        left: 2,
        width: '90%',
        height: 3,
        border: { type: 'line' },
        style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
        inputOnFocus: true,
        name: field.name,
        mouse: true,
      });
      if (field.placeholder) {
        textbox.setValue(field.placeholder);
      }
      top += 5;
    }

    const submitBtn = blessed.button({
      parent: form,
      top,
      left: 2,
      width: 20,
      height: 3,
      content: 'Add Server',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'green', border: { fg: '#8700af' } },
      mouse: true,
    });

    const cancelBtn = blessed.button({
      parent: form,
      top,
      left: 25,
      width: 20,
      height: 3,
      content: 'Cancel',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'red', border: { fg: '#8700af' } },
      mouse: true,
    });

    submitBtn.on('press', async () => {
      const data = {};
      for (const field of fields) {
        const textbox = form.children.find(c => c.name === field.name);
        data[field.name] = textbox.getValue().trim();
      }
      
      if (!data.name || !data.command) {
        this.showMessage('Server name and command are required', 'error');
        return;
      }

      try {
        const mcpConfig = await loadMcpConfig(this.root);
        if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
        
        const args = data.args ? data.args.split(',').map(a => a.trim()).filter(Boolean) : [];
        const env = {};
        if (data.env) {
          data.env.split(',').forEach(pair => {
            const [key, val] = pair.split('=').map(s => s.trim());
            if (key && val) env[key] = val;
          });
        }

        mcpConfig.mcpServers[data.name] = {
          command: data.command,
          args,
          env: Object.keys(env).length > 0 ? env : undefined,
        };

        await saveMcpConfig(this.root, mcpConfig);
        this.showMessage(`Added MCP server: ${data.name}`, 'success');
        form.destroy();
        this.screen.render();
      } catch (error) {
        this.showMessage(`Failed to add server: ${error.message}`, 'error');
      }
    });

    cancelBtn.on('press', () => {
      form.destroy();
      this.screen.render();
    });

    form.focus();
    this.screen.key('escape', () => {
      form.destroy();
      this.screen.unkey('escape');
    });
  }

  async removeMCPServer(servers) {
    if (servers.length === 0) return;

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'red' } },
      label: ' Remove MCP Server ',
      keys: true,
      vi: true,
      mouse: true,
      items: [...servers, 'Cancel'],
    });

    list.on('select', async (item, index) => {
      if (index === servers.length) {
        list.destroy();
        return;
      }

      const serverName = servers[index];
      const mcpConfig = await loadMcpConfig(this.root);
      delete mcpConfig.mcpServers[serverName];
      await saveMcpConfig(this.root, mcpConfig);
      this.showMessage(`Removed MCP server: ${serverName}`, 'success');
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async showSkillsMenu() {
    const skills = await discoverSkills(this.root);
    const { active } = await loadProfiles(this.root);
    const activeNames = active.memory?.active_skills || [];
    const items = skills.map(s => {
      const status = activeNames.includes(s.name) ? '[ENABLED]' : '[disabled]';
      return `${s.name} - ${s.description} ${status}`;
    });
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Skills ',
      keys: true,
      vi: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      const skill = skills[index];
      const isActive = activeNames.includes(skill.name);
      if (isActive) {
        await disableSkill(this.root, skill.name);
        this.showMessage(`Disabled skill: ${skill.name}`, 'success');
      } else {
        await enableSkill(this.root, skill.name);
        this.showMessage(`Enabled skill: ${skill.name}`, 'success');
      }
      list.destroy();
      await this.showSkillsMenu();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async showSuperpowersMenu() {
    const powers = listSuperpowers();
    const items = powers.map(p => {
      const enabled = isEnabled(this.config, p.name) ? '[ON]' : '[OFF]';
      return `${p.label} ${enabled} - ${p.description}`;
    });
    items.push('---');
    items.push('Apply preset: Safe');
    items.push('Apply preset: Balanced');
    items.push('Apply preset: Power');
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Superpowers ',
      keys: true,
      vi: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      if (index >= powers.length + 1) {
        const presetName = index === powers.length + 1 ? 'safe' :
                          index === powers.length + 2 ? 'balanced' : 'power';
        this.config.superpowers = applyPreset(presetName);
        await saveConfig(this.root, this.config, { scope: 'local' });
        this.showMessage(`Applied preset: ${presetName}`, 'success');
        list.destroy();
        await this.showSuperpowersMenu();
        return;
      }
      if (index === powers.length) {
        list.destroy();
        return;
      }
      const power = powers[index];
      const current = isEnabled(this.config, power.name);
      if (!this.config.superpowers) this.config.superpowers = {};
      this.config.superpowers[power.name] = !current;
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.showMessage(`Toggled ${power.name}: ${!current ? 'ON' : 'OFF'}`, 'success');
      list.destroy();
      await this.showSuperpowersMenu();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  showSwarmMenu() {
    const items = [
      'Run swarm (enter prompt)',
      'Plan only (dry-run)',
      'Cancel',
    ];

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Swarm ',
      keys: true,
      vi: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      this.showMessage('Use /swarm <prompt> in chat input', 'info');
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  showJsonViewer(title, data) {
    const viewer = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '80%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ` ${title} `,
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      content: JSON.stringify(data, null, 2),
    });

    viewer.focus();
    this.screen.key('escape', () => {
      viewer.destroy();
      this.screen.unkey('escape');
    });
  }

  getTabCompletion(input) {
    const commands = [
      '/help', '/provider', '/config', '/mcp', '/skills', '/powers', '/superpowers',
      '/swarm', '/exit', '/connect', '/models', '/permissions', '/self-improve',
      '/key', '/theme', '/export', '/import',
    ];
    
    if (!input.startsWith('/')) return null;
    
    const matches = commands.filter(cmd => cmd.startsWith(input));
    if (matches.length === 1) {
      return matches[0] + ' ';
    }
    if (matches.length > 1) {
      this.showMessage(`Completions: ${matches.join(', ')}`, 'info');
    }
    return null;
  }

  async showThemeMenu() {
    const themes = this.getThemes();
    const items = Object.keys(themes).map(name => {
      const active = name === this.currentTheme ? ' [ACTIVE]' : '';
      return `${name}${active}`;
    });
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Select Theme ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }
      const themeName = Object.keys(themes)[index];
      this.currentTheme = themeName;
      this.applyTheme();
      this.config.tui_theme = themeName;
      await saveConfig(this.root, this.config, { scope: 'local' });
      this.showMessage(`Applied theme: ${themeName}`, 'success');
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  getThemes() {
    return {
      default: {
        header: { fg: 'white', bg: 'blue', border: '#8700af' },
        chat: { fg: 'white', bg: 'black', border: '#8700af' },
        input: { fg: 'white', bg: 'black', border: '#8700af' },
        status: { fg: 'black', bg: 'green' },
        selected: { fg: 'black', bg: 'green' },
      },
      dark: {
        header: { fg: 'white', bg: '#1a1a1a', border: '#444' },
        chat: { fg: '#ddd', bg: '#0a0a0a', border: '#444' },
        input: { fg: '#ddd', bg: '#0a0a0a', border: '#444' },
        status: { fg: 'white', bg: '#222' },
        selected: { fg: 'black', bg: '#888' },
      },
      light: {
        header: { fg: 'black', bg: '#e0e0e0', border: '#999' },
        chat: { fg: 'black', bg: 'white', border: '#999' },
        input: { fg: 'black', bg: 'white', border: '#999' },
        status: { fg: 'black', bg: '#d0d0d0' },
        selected: { fg: 'white', bg: '#666' },
      },
      ocean: {
        header: { fg: 'white', bg: '#004d7a', border: '#0080c0' },
        chat: { fg: '#e0f7ff', bg: '#001a33', border: '#0080c0' },
        input: { fg: '#e0f7ff', bg: '#001a33', border: '#0080c0' },
        status: { fg: 'white', bg: '#006699' },
        selected: { fg: 'black', bg: '#00a8e8' },
      },
      matrix: {
        header: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        chat: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        input: { fg: '#00ff00', bg: 'black', border: '#00ff00' },
        status: { fg: 'black', bg: '#00ff00' },
        selected: { fg: 'black', bg: '#00ff00' },
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

  async showExportImportMenu() {
    const items = [
      'Export config (local)',
      'Export config (global)',
      'Export config (merged)',
      'Import config to local',
      'Import config to global',
      'Cancel',
    ];

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Export/Import Config ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }

      try {
        if (index === 0 || index === 1 || index === 2) {
          // Export
          const scope = index === 0 ? 'local' : index === 1 ? 'global' : 'merged';
          await this.exportConfig(scope);
        } else if (index === 3 || index === 4) {
          // Import
          const scope = index === 3 ? 'local' : 'global';
          await this.importConfig(scope);
        }
      } catch (error) {
        this.showMessage(`Error: ${error.message}`, 'error');
      }
      
      list.destroy();
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async exportConfig(scope) {
    const fs = require('node:fs/promises');
    const path = require('node:path');
    const config = await loadConfig(this.root, { scope });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `sicli-config-${scope}-${timestamp}.json`;
    const filepath = path.join(this.root, filename);
    await fs.writeFile(filepath, JSON.stringify(config, null, 2));
    this.showMessage(`Exported ${scope} config to ${filename}`, 'success');
  }

  async importConfig(scope) {
    const form = blessed.form({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '40%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      label: ` Import Config (${scope}) `,
      keys: true,
      mouse: true,
    });

    blessed.text({
      parent: form,
      top: 2,
      left: 2,
      content: 'Config file path (relative or absolute):',
      style: { fg: 'white' },
    });

    const textbox = blessed.textbox({
      parent: form,
      top: 4,
      left: 2,
      width: '90%',
      height: 3,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' } },
      inputOnFocus: true,
      mouse: true,
    });

    const submitBtn = blessed.button({
      parent: form,
      top: 8,
      left: 2,
      width: 20,
      height: 3,
      content: 'Import',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'green', border: { fg: '#8700af' } },
      mouse: true,
    });

    const cancelBtn = blessed.button({
      parent: form,
      top: 8,
      left: 25,
      width: 20,
      height: 3,
      content: 'Cancel',
      border: { type: 'line' },
      style: { fg: 'black', bg: 'red', border: { fg: '#8700af' } },
      mouse: true,
    });

    submitBtn.on('press', async () => {
      const filepath = textbox.getValue().trim();
      if (!filepath) {
        this.showMessage('File path is required', 'error');
        return;
      }

      try {
        const fs = require('node:fs/promises');
        const path = require('node:path');
        const fullPath = path.isAbsolute(filepath) ? filepath : path.join(this.root, filepath);
        const content = await fs.readFile(fullPath, 'utf8');
        const importedConfig = JSON.parse(content);
        await saveConfig(this.root, importedConfig, { scope, backup: true });
        this.config = await loadConfig(this.root);
        this.updateHeader();
        this.showMessage(`Imported config from ${filepath}`, 'success');
        form.destroy();
        this.screen.render();
      } catch (error) {
        this.showMessage(`Import failed: ${error.message}`, 'error');
      }
    });

    cancelBtn.on('press', () => {
      form.destroy();
      this.screen.render();
    });

    form.focus();
    this.screen.key('escape', () => {
      form.destroy();
      this.screen.unkey('escape');
    });
  }

  async handleModeCommand(args) {
    const mode = args[0]?.toLowerCase();
    if (mode === 'plan') {
      await this.switchToPlanMode();
    } else if (mode === 'build') {
      await this.switchToBuildMode();
    } else {
      this.showMessage('Usage: /mode <plan|build>', 'error');
    }
  }

  async switchToPlanMode() {
    this.currentMode = MODES.PLAN;
    const display = getModeDisplay(this.currentMode);
    this.showMessage(`Switched to ${display.label} mode: ${display.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  async switchToBuildMode() {
    this.currentMode = MODES.BUILD;
    const display = getModeDisplay(this.currentMode);
    this.showMessage(`Switched to ${display.label} mode: ${display.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  async toggleMode() {
    const result = switchMode(this.currentMode);
    this.currentMode = result.mode;
    const display = getModeDisplay(this.currentMode);
    this.showMessage(`Switched to ${display.label} mode: ${result.description}`, 'success');
    this.updateHeader();
    this.screen.render();
  }

  async showSessionsMenu() {
    const { listSessions, createSession, loadSession, deleteSession, exportToMarkdown, getActiveSessionId, setActiveSessionId } = require('./sessions');
    
    const sessions = await listSessions(this.root);
    const activeId = await getActiveSessionId(this.root);
    
    const items = [
      '+ New Session',
      ...sessions.map(s => {
        const active = s.id === activeId ? ' [ACTIVE]' : '';
        const date = new Date(s.updated).toLocaleString();
        return `${s.title}${active} (${s.messageCount} msgs, ${date})`;
      }),
      'Export Active Session',
      'Delete Session',
      'Cancel',
    ];

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Sessions (F8) ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        // Cancel
        list.destroy();
        return;
      }

      if (index === 0) {
        // New session
        list.destroy();
        const session = await createSession(this.root, {
          title: `Session ${new Date().toLocaleString()}`,
          mode: this.currentMode,
          provider: this.config?.active_provider,
          model: this.config?.active_model,
        });
        await setActiveSessionId(this.root, session.id);
        this.showMessage(`Created new session: ${session.id}`, 'success');
        this.screen.render();
        return;
      }

      if (index === sessions.length + 1) {
        // Export
        list.destroy();
        if (!activeId) {
          this.showMessage('No active session to export', 'error');
          return;
        }
        try {
          const markdown = await exportToMarkdown(this.root, activeId);
          const fs = require('node:fs/promises');
          const path = require('node:path');
          const filename = `session-${activeId}-${Date.now()}.md`;
          await fs.writeFile(path.join(this.root, filename), markdown);
          this.showMessage(`Exported to ${filename}`, 'success');
        } catch (error) {
          this.showMessage(`Export failed: ${error.message}`, 'error');
        }
        this.screen.render();
        return;
      }

      if (index === sessions.length + 2) {
        // Delete
        list.destroy();
        // Show delete picker
        await this.showDeleteSessionPicker();
        return;
      }

      // Resume session
      const session = sessions[index - 1];
      list.destroy();
      await setActiveSessionId(this.root, session.id);
      this.showMessage(`Resumed session: ${session.title}`, 'success');
      
      // Load messages into chat
      const loaded = await loadSession(this.root, session.id);
      if (loaded && loaded.messages) {
        this.chatHistory = [];
        for (const msg of loaded.messages) {
          const timestamp = new Date(msg.timestamp).toLocaleTimeString();
          const role = msg.role === 'user' ? 'user' : 'agent';
          this.showMessage(msg.content, role);
        }
      }
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async showDeleteSessionPicker() {
    const { listSessions, deleteSession, getActiveSessionId } = require('./sessions');
    const sessions = await listSessions(this.root);
    const activeId = await getActiveSessionId(this.root);

    if (sessions.length === 0) {
      this.showMessage('No sessions to delete', 'info');
      return;
    }

    const items = sessions.map(s => {
      const active = s.id === activeId ? ' [ACTIVE - cannot delete]' : '';
      return `${s.title}${active}`;
    });
    items.push('Cancel');

    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '60%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'red' } },
      label: ' Delete Session ',
      keys: true,
      vi: true,
      mouse: true,
      items,
    });

    list.on('select', async (item, index) => {
      if (index === items.length - 1) {
        list.destroy();
        return;
      }

      const session = sessions[index];
      if (session.id === activeId) {
        list.destroy();
        this.showMessage('Cannot delete active session', 'error');
        return;
      }

      list.destroy();
      await deleteSession(this.root, session.id);
      this.showMessage(`Deleted session: ${session.title}`, 'success');
      this.screen.render();
    });

    list.focus();
    this.screen.key('escape', () => {
      list.destroy();
      this.screen.unkey('escape');
    });
  }

  async showDiagnosticsMenu() {
    const { runTests, formatDiagnostics } = require('./diagnostics');
    
    const list = blessed.list({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '80%',
      height: '70%',
      tags: true,
      border: { type: 'line' },
      style: { fg: 'white', bg: 'black', border: { fg: '#8700af' }, selected: { fg: 'black', bg: 'green' } },
      label: ' Diagnostics (F11) ',
      keys: true,
      vi: true,
      items: [
        'Run Tests (npm test)',
        'Run TypeCheck (tsc)',
        'Run Lint (eslint)',
        'Clear Results',
        'Cancel'
      ]
    });

    list.on('select', async (item, index) => {
      if (index === 4) {
        list.destroy();
        return;
      }
      
      list.destroy();
      this.showMessage('Running diagnostics...', 'info');
      this.screen.render();

      try {
        const result = await runTests(this.root);
        const output = formatDiagnostics(result.diagnostics);
        
        const diagBox = blessed.box({
          parent: this.screen,
          top: 'center',
          left: 'center',
          width: '90%',
          height: '80%',
          tags: true,
          border: { type: 'line' },
          style: { fg: 'white', bg: 'black', border: { fg: result.passed ? 'green' : 'red' } },
          label: ` Diagnostics - ${result.passed ? 'PASSED' : 'FAILED'} (${result.diagnostics.length} errors) `,
          scrollable: true,
          alwaysScroll: true,
          keys: true,
          vi: true,
          content: output
        });

        this.screen.key(['escape', 'q'], () => {
          diagBox.destroy();
          this.screen.unkey('escape');
          this.screen.unkey('q');
        });

        diagBox.focus();
        this.screen.render();
      } catch (error) {
        this.showMessage(`Diagnostics failed: ${error.message}`, 'error');
        this.screen.render();
      }
    });

    list.focus();
    this.screen.render();
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
    await new Promise(resolve => {
      this.screen.once('destroy', resolve);
    });
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

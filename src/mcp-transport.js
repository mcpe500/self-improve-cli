'use strict';

const { spawn } = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const { EventEmitter } = require('node:events');

function interpolateEnv(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || `\${${name}}`);
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = interpolateEnv(v);
    return out;
  }
  return obj;
}

class StdioTransport extends EventEmitter {
  constructor(serverConfig) {
    super();
    this.command = serverConfig.command;
    this.args = serverConfig.args || [];
    this.env = { ...process.env, ...(serverConfig.env || {}) };
    this.timeout = serverConfig.timeout || 30000;
    this.proc = null;
    this._nextId = 1;
    this._pending = new Map();
    this._buffer = Buffer.alloc(0);
    this._connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.proc = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: this.env
        });
      } catch (err) {
        reject(err);
        return;
      }

      const onError = (err) => {
        this._connected = false;
        this.emit('error', err);
        reject(err);
      };

      const onExit = (code, signal) => {
        this._connected = false;
        const err = new Error(`MCP server exited with code ${code}, signal ${signal}`);
        for (const [, pending] of this._pending) {
          pending.reject(err);
        }
        this._pending.clear();
        this.emit('disconnected', { code, signal });
      };

      this.proc.on('error', onError);
      this.proc.on('exit', onExit);
      this.proc.stderr.on('data', (d) => process.stderr.write(d));

      this.proc.stdout.on('data', (chunk) => {
        this._buffer = Buffer.concat([this._buffer, chunk]);
        this._parseBuffer();
      });

      this._connected = true;
      this.emit('connected');
      resolve();
    });
  }

  _parseBuffer() {
    while (true) {
      if (this._buffer.length < 4) return;
      const headerEnd = this._findHeaderEnd();
      if (headerEnd === -1) return;
      const headerStr = this._buffer.slice(0, headerEnd).toString('utf8');
      const match = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this._buffer = this._buffer.slice(headerEnd + 4);
        continue;
      }
      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (this._buffer.length < bodyStart + contentLength) return;
      const body = this._buffer.slice(bodyStart, bodyStart + contentLength).toString('utf8');
      this._buffer = this._buffer.slice(bodyStart + contentLength);
      try {
        const msg = JSON.parse(body);
        this._handleMessage(msg);
      } catch {
        this.emit('error', new Error('Malformed JSON-RPC message'));
      }
    }
  }

  _findHeaderEnd() {
    for (let i = 0; i <= this._buffer.length - 4; i++) {
      if (this._buffer[i] === 0x0d && this._buffer[i + 1] === 0x0a &&
          this._buffer[i + 2] === 0x0d && this._buffer[i + 3] === 0x0a) {
        return i;
      }
    }
    return -1;
  }

  _handleMessage(msg) {
    if (msg.id != null && this._pending.has(msg.id)) {
      const { resolve, reject } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    }
  }

  async send(message) {
    const id = this._nextId++;
    const msg = { jsonrpc: '2.0', id, ...message };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`MCP request timed out after ${this.timeout}ms`));
      }, this.timeout);
      this._pending.set(id, {
        resolve: (result) => { clearTimeout(timer); resolve(result); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      this._write(msg);
    });
  }

  async notify(message) {
    const msg = { jsonrpc: '2.0', ...message };
    this._write(msg);
  }

  _write(msg) {
    const body = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this.proc.stdin.write(header + body);
  }

  disconnect() {
    if (!this.proc) return;
    try {
      if (process.platform === 'win32') {
        this.proc.kill();
      } else {
        this.proc.kill('SIGTERM');
        const force = setTimeout(() => { try { this.proc.kill('SIGKILL'); } catch {} }, 5000);
        force.unref();
      }
    } catch {}
    for (const [, pending] of this._pending) {
      pending.reject(new Error('Transport disconnected'));
    }
    this._pending.clear();
    this.proc = null;
    this._connected = false;
    this.emit('disconnected');
  }
}

class HTTPTransport extends EventEmitter {
  constructor(serverConfig) {
    super();
    this.url = serverConfig.url;
    this.headers = interpolateEnv(serverConfig.headers || {});
    this.timeout = serverConfig.timeout || 30000;
    this._nextId = 1;
    this._connected = false;
    this._controller = null;
  }

  async connect() {
    try {
      new URL(this.url);
    } catch {
      throw new Error(`Invalid MCP server URL: ${this.url}`);
    }
    this._connected = true;
    this.emit('connected');
  }

  async send(message) {
    const id = this._nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', id, ...message });
    this._controller = new AbortController();
    const timer = setTimeout(() => this._controller.abort(), this.timeout);
    try {
      const response = await this._post(body);
      clearTimeout(timer);
      const msg = JSON.parse(response);
      if (msg.error) {
        throw new Error(msg.error.message || JSON.stringify(msg.error));
      }
      return msg.result;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`MCP request timed out after ${this.timeout}ms`);
      }
      throw err;
    }
  }

  async notify(message) {
    const body = JSON.stringify({ jsonrpc: '2.0', ...message });
    try {
      await this._post(body);
    } catch {}
  }

  _post(body) {
    const urlObj = new URL(this.url);
    const mod = urlObj.protocol === 'https:' ? https : http;
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...this.headers
    };
    return new Promise((resolve, reject) => {
      const req = mod.request(urlObj, { method: 'POST', headers, signal: this._controller?.signal }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  disconnect() {
    if (this._controller) {
      try { this._controller.abort(); } catch {}
      this._controller = null;
    }
    this._connected = false;
    this.emit('disconnected');
  }
}

module.exports = { StdioTransport, HTTPTransport, interpolateEnv };

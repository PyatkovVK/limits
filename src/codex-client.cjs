'use strict';
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');

class CodexClient extends EventEmitter {
  constructor(binary, { timeout = 20000, args = ['app-server', '--listen', 'stdio://'], env = process.env } = {}) {
    super();
    Object.assign(this, { binary, timeout, args, env });
    this.pending = new Map();
    this.sequence = 0;
    this.child = null;
    this.starting = null;
  }

  start() {
    if (this.starting) return this.starting;
    if (this.child) return Promise.resolve();
    this.starting = this.connect().finally(() => { this.starting = null; });
    return this.starting;
  }

  async connect() {
    const child = spawn(this.binary, this.args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: this.env });
    this.child = child;
    // Never forward stderr: it may contain account or authentication details.
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.method && message.id !== undefined) {
        this.write({ id: message.id, error: { code: -32601, message: 'Unsupported client request' } });
      } else if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.error) {
          const error = new Error(message.error.message || 'Codex RPC error');
          error.code = message.error.code;
          pending.reject(error);
        } else pending.resolve(message.result);
      } else if (message.method) this.emit('notification', message.method, message.params || {});
    });
    const disconnect = error => {
      if (this.child !== child) return;
      this.child = null;
      lines.close();
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.emit('disconnected', error);
    };
    child.on('error', () => disconnect(new Error('Не удалось запустить Codex App Server.')));
    child.on('exit', () => disconnect(new Error('Соединение с Codex закрыто. Повторяем подключение.')));
    child.stdin.on('error', () => disconnect(new Error('Соединение с Codex потеряно.')));
    try {
      await this.request('initialize', { clientInfo: { name: 'codex_limits', title: 'Codex Limits', version: require('../package.json').version } });
      this.write({ method: 'initialized', params: {} });
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  write(message) {
    if (!this.child || this.child.stdin.destroyed) throw new Error('Codex не подключён.');
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Codex не ответил вовремя. Проверяем соединение.'));
        this.stop();
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.write({ id, method, ...(params === undefined ? {} : { params }) }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  stop() {
    const child = this.child;
    this.child = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('Codex остановлен.')); }
    this.pending.clear();
    if (child) { child.stdin.destroy(); child.kill(); }
  }
}

module.exports = { CodexClient };

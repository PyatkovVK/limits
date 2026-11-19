'use strict';
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');

class TaskbarProbe extends EventEmitter {
  constructor(binary, { args = [String(process.pid)], interval = 1000, timeout = 3000, retryDelay = 1000 } = {}) {
    super();
    Object.assign(this, { binary, args, interval, timeout, retryDelay });
    this.child = null;
    this.stopped = true;
  }
  start() {
    if (!this.stopped) return this.started;
    this.stopped = false;
    this.started = new Promise(resolve => { this.firstResolve = resolve; });
    this.connect();
    return this.started;
  }
  finish(metrics) { this.firstResolve?.(metrics); this.firstResolve = null; }
  setParented(parented, bounds) {
    this.args[2] = parented ? 'taskbar' : 'overlay';
    const command = parented ? 'parent-taskbar' : 'parent-overlay';
    const geometry = bounds ? ' ' + ['x', 'y', 'width', 'height'].map(key => Math.round(bounds[key])).join(' ') : '';
    if (!this.stopped && this.child && !this.child.stdin.destroyed) this.child.stdin.write(command + geometry + '\n');
  }
  connect() {
    if (this.stopped) return;
    const child = spawn(this.binary, this.args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    child.stderr.resume();
    const lines = createInterface({ input: child.stdout });
    let waiting = false, failed = false;
    const fail = () => {
      if (failed || this.child !== child || this.stopped) return;
      failed = true;
      this.cleanup();
      const metrics = { available: false };
      this.emit('metrics', metrics);
      this.finish(metrics);
      this.retry = setTimeout(() => this.connect(), this.retryDelay);
    };
    child.once('error', fail);
    child.once('exit', fail);
    child.stdin.on('error', fail);
    lines.on('line', line => {
      if (this.child !== child) return;
      let metrics;
      try { metrics = JSON.parse(line); } catch { fail(); return; }
      if (metrics.input) { this.emit('input', metrics.input); return; }
      waiting = false;
      clearTimeout(this.deadline);
      this.emit('metrics', metrics);
      this.finish(metrics);
    });
    this.lines = lines;
    const query = () => {
      if (waiting || this.child !== child || child.stdin.destroyed) return;
      waiting = true;
      this.deadline = setTimeout(fail, this.timeout);
      child.stdin.write('query\n');
    };
    query();
    this.timer = setInterval(query, this.interval);
  }
  cleanup() {
    clearInterval(this.timer);
    clearTimeout(this.deadline);
    this.lines?.close();
    const child = this.child;
    this.child = null;
    child?.stdin.destroy();
    child?.kill();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.retry);
    this.cleanup();
    this.finish({ available: false });
  }
}

module.exports = { TaskbarProbe };

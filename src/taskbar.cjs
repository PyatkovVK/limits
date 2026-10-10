'use strict';
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');

function widgetBounds(metrics, { width = 320, xRatio = null } = {}) {
  if (!metrics?.available || !metrics.visible || metrics.fullscreen) return null;
  const bar = metrics.bar;
  if (bar.height > bar.width || bar.height < 30) return null;
  const left = bar.x + 56; // Leave the Start button accessible.
  const trayLeft = metrics.tray?.x > left ? metrics.tray.x : bar.x + bar.width - 300;
  const right = Math.min(bar.x + bar.width, trayLeft) - 8;
  const available = right - left;
  if (available < 240) return null;
  width = Math.min(Math.max(240, width), available);
  const height = Math.min(34, bar.height - 2);
  const x = Number.isFinite(xRatio) ? Math.round(bar.x + xRatio * bar.width) : right - width;
  return { x: Math.min(right - width, Math.max(left, x)), y: bar.y + Math.floor((bar.height - height) / 2), width: Math.round(width), height: Math.round(height) };
}

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
module.exports = { TaskbarProbe, widgetBounds };

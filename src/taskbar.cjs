'use strict';
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');

function widgetBounds(metrics, { width = 520, xRatio = null } = {}) {
  if (!metrics?.available || !metrics.visible || metrics.fullscreen) return null;
  const bar = metrics.bar;
  if (bar.height > bar.width || bar.height < 30) return null;
  const left = bar.x + 56; // Leave the Start button accessible.
  const trayLeft = metrics.tray?.x > left ? metrics.tray.x : bar.x + bar.width - 300;
  const right = Math.min(bar.x + bar.width, trayLeft) - 8;
  const available = right - left;
  if (available < 360) return null;
  width = Math.min(Math.max(360, width), available);
  const height = Math.min(62, bar.height - 2);
  const x = Number.isFinite(xRatio) ? Math.round(bar.x + xRatio * bar.width) : right - width;
  return { x: Math.min(right - width, Math.max(left, x)), y: bar.y + Math.floor((bar.height - height) / 2), width: Math.round(width), height: Math.round(height) };
}

class TaskbarProbe extends EventEmitter {
  constructor(binary) { super(); this.binary = binary; this.child = null; this.timer = null; this.waiting = false; }
  start() {
    return new Promise(resolve => {
      const child = spawn(this.binary, [String(process.pid)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      this.child = child; child.stderr.resume();
      let settled = false;
      const finish = value => { if (!settled) { settled = true; clearTimeout(deadline); resolve(value); } };
      const deadline = setTimeout(() => { finish({ available: false }); this.stop(); }, 5000);
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => {
        this.waiting = false;
        try { const metrics = JSON.parse(line); this.emit('metrics', metrics); finish(metrics); } catch { finish({ available: false }); }
      });
      child.on('error', () => { finish({ available: false }); this.stop(); });
      child.on('exit', () => { this.emit('metrics', { available: false }); finish({ available: false }); clearInterval(this.timer); });
      child.stdin.on('error', () => finish({ available: false }));
      const query = () => { if (!this.waiting && !child.stdin.destroyed) { this.waiting = true; child.stdin.write('query\n'); } };
      query(); this.timer = setInterval(query, 1000);
    });
  }
  stop() { clearInterval(this.timer); this.child?.stdin.destroy(); this.child?.kill(); this.child = null; }
}
module.exports = { TaskbarProbe, widgetBounds };

'use strict';
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { EventEmitter } = require('node:events');

function widgetBounds(metrics, { width = 280, xRatio = null } = {}) {
  if (!metrics?.available || !metrics.visible || (metrics.fullscreen && !metrics.shellFlyout)) return null;
  const bar = metrics.bar;
  const monitor = metrics.monitor;
  if (!bar) return null;
  if (bar.height > bar.width || bar.height < 30) return null;
  const left = bar.x + 56; // Leave the Start button accessible.
  const trayLeft = metrics.tray?.x > left ? metrics.tray.x : bar.x + bar.width - 300;
  const right = Math.min(bar.x + bar.width, trayLeft) - 8;
  // Accessibility rectangles cover centered app buttons and the left Widgets button.
  // Subtract them before choosing a position, including when the user drags the widget.
  const occupied = (Array.isArray(metrics.occupied) ? metrics.occupied : [])
    .filter(rect => rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])) &&
      rect.width > 0 && rect.height > 0 && rect.y < bar.y + bar.height && rect.y + rect.height > bar.y)
    .map(rect => ({ left: Math.max(left, Math.floor(rect.x - 8)), right: Math.min(right, Math.ceil(rect.x + rect.width + 8)) }))
    .filter(rect => rect.right > rect.left)
    .sort((a, b) => a.left - b.left);
  const gaps = [];
  let cursor = left;
  for (const rect of occupied) {
    if (rect.left > cursor) gaps.push({ left: cursor, right: rect.left });
    cursor = Math.max(cursor, rect.right);
  }
  if (right > cursor) gaps.push({ left: cursor, right });
  const candidates = gaps.filter(gap => gap.right - gap.left >= 200);
  const preferredWidth = Math.max(200, Number.isFinite(width) ? width : 280);
  const desiredX = Number.isFinite(xRatio) ? Math.round(bar.x + xRatio * bar.width) : null;
  const height = Math.min(34, bar.height - 2);
  if (!candidates.length) {
    // A busy taskbar must not make the bar disappear or cover shell buttons.
    // Use a row immediately beside the taskbar until a readable gap returns.
    const fittedWidth = Math.min(preferredWidth, bar.width - 16);
    const x = Math.min(bar.x + bar.width - fittedWidth - 8, Math.max(bar.x + 8, desiredX ?? right - fittedWidth));
    const top = monitor ? bar.y < monitor.y + monitor.height / 2 : bar.y <= 0;
    return { x: Math.round(x), y: Math.round(top ? bar.y + bar.height + 8 : bar.y - height - 8), width: Math.round(fittedWidth), height: Math.round(height) };
  }
  const boundsInGap = gap => {
    const fittedWidth = Math.min(preferredWidth, gap.right - gap.left);
    const x = desiredX === null ? gap.right - fittedWidth : Math.min(gap.right - fittedWidth, Math.max(gap.left, desiredX));
    return { x, width: fittedWidth };
  };
  // Prefer the tray side, shrinking there first. If it cannot fit 200 DIP, move left.
  let fitted = boundsInGap(candidates[candidates.length - 1]);
  if (desiredX !== null) {
    for (const gap of candidates) {
      const candidate = boundsInGap(gap);
      if (Math.abs(candidate.x - desiredX) < Math.abs(fitted.x - desiredX)) fitted = candidate;
    }
  }
  return { x: Math.round(fitted.x), y: bar.y + Math.floor((bar.height - height) / 2), width: Math.round(fitted.width), height: Math.round(height) };
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

// Cache both the requested and accepted bounds: Windows may clamp a frameless
// window's height. Repeating that rejected resize on every poll causes flashing.
class WidgetPlacement {
  constructor(window, { setParented } = {}) {
    this.window = window;
    this.setParented = setParented;
    this.requested = null;
    this.actual = null;
    this.changes = { bounds: 0, shows: 0, hides: 0 };
  }
  apply(metrics, settings) {
    const target = this.window;
    if (target.isDestroyed()) return;
    // The helper may restart or time out while Explorer rebuilds accessibility
    // controls. Keep the last usable placement throughout that interruption.
    if (metrics?.available) {
      const sameBar = this.stableLayout && ['x', 'y', 'width', 'height'].every(key => this.stableLayout.bar?.[key] === metrics.bar?.[key]);
      // Flyout animations temporarily change the accessible tray/control
      // rectangles. They must not replace the user's placement with a new gap.
      const incompleteTray = !metrics.tray && this.stableLayout?.tray;
      this.metrics = sameBar && (metrics.shellFlyout || incompleteTray)
        ? { ...metrics, tray: this.stableLayout.tray, occupied: this.stableLayout.occupied,
          visible: metrics.visible || (metrics.shellFlyout && this.stableLayout.visible) }
        : metrics;
      if (!metrics.shellFlyout && (!sameBar || !incompleteTray)) this.stableLayout = metrics;
    }
    const bounds = settings.visible ? widgetBounds(this.metrics, settings) : null;
    if (!bounds) {
      if (target.isVisible()) { target.hide(); this.changes.hides++; }
      return;
    }
    // A crowded taskbar uses the existing floating row above it. Change the
    // native parent before moving there so child clipping never hides the bar.
    if (this.setParented && typeof this.metrics?.parented === 'boolean') {
      const bar = this.metrics.bar;
      const parented = bounds.y >= bar.y && bounds.y + bounds.height <= bar.y + bar.height;
      if (parented !== this.metrics.parented) {
        if (this.pendingParented !== parented) { this.pendingParented = parented; this.setParented(parented, bounds); }
        return;
      }
      this.pendingParented = null;
    }
    const equal = (a, b) => a && b && ['x', 'y', 'width', 'height'].every(key => a[key] === b[key]);
    if (!equal(this.requested, bounds) || !equal(this.actual, target.getBounds())) {
      target.setBounds(this.metrics?.parented ? { ...bounds,
        x: bounds.x - this.metrics.bar.x, y: bounds.y - this.metrics.bar.y } : bounds);
      this.requested = bounds;
      this.actual = target.getBounds();
      this.changes.bounds++;
    }
    const newObservation = metrics?.available && metrics !== this.orderMetrics;
    const showing = !target.isVisible() || (newObservation && metrics.widgetVisible === false);
    if (showing) {
      target.showInactive();
      // Ownership is assigned while hidden. Complete the first show in front of
      // the taskbar without waiting for Explorer to be activated by a click.
      this.changes.shows++;
    }
    // Windows can demote an owned window when its owner changes topmost state.
    // Repair only observed loss, never raise on every unchanged poll.
    const lostOrder = newObservation &&
      (metrics.topmost === false || metrics.aboveTaskbar === false);
    if (!this.metrics?.parented) {
      if (!target.isAlwaysOnTop() || lostOrder) target.setAlwaysOnTop(true);
      if (showing || lostOrder) target.moveTop();
    }
    this.orderMetrics = metrics;
  }
}
module.exports = { TaskbarProbe, widgetBounds, WidgetPlacement };

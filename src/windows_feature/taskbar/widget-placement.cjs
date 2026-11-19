'use strict';
const { widgetBounds } = require('./widget-bounds.cjs');

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

module.exports = { WidgetPlacement };

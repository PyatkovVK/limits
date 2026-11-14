'use strict';
const { menuBarWidth } = require('./geometry.cjs');

class MenuBarMeasurement {
  constructor({ readScreens, now, growDelay }) {
    this.readScreens = readScreens;
    this.now = now;
    this.growDelay = growDelay;
  }

  resetContext() {
    this.context = null;
    this.pendingContext = null;
  }

  resetGrowth() {
    this.growth = null;
  }

  remember(info) {
    const previous = this.info;
    const sameNotch = info && previous?.id === info.id && previous.notchX === info.notchX && previous.notchWidth === info.notchWidth;
    if (!sameNotch) this.resetContext();
    this.info = sameNotch ? this.withKnownBoundaries(info) : info;
    return this.info;
  }

  withKnownBoundaries(info) {
    const measured = { ...info };
    for (const key of ['menuBarLeft', 'menuBarRight']) {
      if (!Number.isFinite(measured[key]) && Number.isFinite(this.info?.[key])) measured[key] = this.info[key];
    }
    return measured;
  }

  async read(displayId, measureStatusItems) {
    try {
      const screens = await this.readScreens({ measureStatusItems });
      return screens.find(info => info.id === displayId && info.top > 0 && info.notchWidth > 0);
    } catch {
      return null;
    }
  }

  async refresh({ display, indicatorMode, previousWidth, mode, initial, isCurrent }) {
    if (this.pending) return null;
    this.pending = true;
    try {
      let info = await this.read(display.id, false);
      if (!isCurrent()) return null;
      // A failed probe leaves the last confirmed width in place.
      if (!info) {
        this.resetGrowth();
        this.pendingContext = null;
        return null;
      }

      const context = { apps: info.menuBarContext, foreground: info.menuBarForeground };
      const stable = context.apps && context.apps === this.pendingContext?.apps && context.foreground === this.pendingContext?.foreground;
      const appsChanged = context.apps !== this.context?.apps;
      // The foreground app can free up space even when the running apps stay the same.
      const foregroundChanged = indicatorMode !== 'full' && context.foreground > 0 && context.foreground !== this.context?.foreground;
      this.pendingContext = context;

      // Periodic reads only insert a status item after a stable change in context.
      if (mode === 'island' && !Number.isFinite(info.menuBarRight) && (initial || (stable && (appsChanged || foregroundChanged)))) {
        const measured = await this.read(display.id, true);
        if (!isCurrent()) return null;
        if (!measured || (measured.menuBarContext === context.apps && measured.menuBarForeground === context.foreground)) {
          if (measured) info = measured;
          this.context = context;
        }
      } else if (Number.isFinite(info.menuBarRight)) {
        this.context = context;
      }

      this.info = this.withKnownBoundaries(info);
      return this.stableWidth(menuBarWidth(display, this.info), previousWidth, initial);
    } finally {
      this.pending = false;
    }
  }

  stableWidth(width, previousWidth, initial) {
    const change = width - previousWidth;
    // The side insets absorb small variations without moving the panel.
    if (change === 0 || (!initial && Math.abs(change) < 8)) {
      this.resetGrowth();
      return null;
    }
    if (!initial && change > 0) {
      // Use the space confirmed by every sample during the growth delay.
      const now = this.now();
      this.growth ??= { width, since: now };
      this.growth.width = Math.min(this.growth.width, width);
      if (now - this.growth.since < this.growDelay) return null;
      width = this.growth.width;
    }
    this.resetGrowth();
    return width;
  }
}

module.exports = { MenuBarMeasurement };

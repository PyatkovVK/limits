'use strict';

const validBounds = bounds => bounds &&
  ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) &&
  bounds.width > 0 && bounds.height > 0;

// Owns tray-host fallbacks and their cache; panel placement only consumes bounds.
class TrayAnchor {
  constructor(screen) {
    this.screen = screen;
    this.activations = new Map();
  }

  bounds(tray) {
    try {
      const bounds = tray?.getBounds?.();
      return validBounds(bounds) ? bounds : null;
    } catch {
      return null; // Linux tray hosts may not expose icon geometry.
    }
  }

  read(tray) {
    if (!tray) return null;
    const bounds = this.bounds(tray);
    if (bounds) return bounds;

    try {
      // Capture the cursor during activation, never during content resizing.
      const point = this.screen.getCursorScreenPoint();
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
      const display = this.screen.getDisplayNearestPoint(point);
      const area = display.bounds || display.workArea;
      if (Math.min(Math.abs(point.y - area.y), Math.abs(point.y - area.y - area.height)) > 64) return null;
      // Retain the first activation point on each display edge for SNI hosts
      // that report an empty icon rectangle and varying click coordinates.
      const edge = point.y < area.y + area.height / 2 ? 'top' : 'bottom';
      const key = `${area.x}:${area.y}:${area.width}:${area.height}:${edge}`;
      if (!this.activations.has(key)) this.activations.set(key, { ...point, width: 1, height: 1 });
      return this.activations.get(key);
    } catch {
      return null; // Cursor coordinates may be unavailable on Wayland.
    }
  }

  clear() {
    this.activations.clear();
  }
}

module.exports = { TrayAnchor };

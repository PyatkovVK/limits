'use strict';

class WidgetInput {
  reset() {
    this.dragOffset = null;
    this.nativeButton = null;
  }

  drag(window, phase, point, onMove) {
    if (!window || window.isDestroyed() || !window.isVisible()) return false;
    if (!['start', 'move', 'end', 'cancel'].includes(phase) || !Number.isFinite(point?.x)) return false;
    if (phase === 'start') {
      this.dragOffset = point.x - window.getBounds().x;
      this.dragStart = { ...point };
      this.dragMoved = false;
      return true;
    }
    if (!Number.isFinite(this.dragOffset)) return false;
    // Keep the original grab offset while placement clamps the window to a free gap.
    if (phase !== 'cancel') {
      if (Math.hypot(point.x - this.dragStart.x, (point.y || 0) - (this.dragStart.y || 0)) >= 4) this.dragMoved = true;
      if (this.dragMoved) onMove({ ...window.getBounds(), x: point.x - this.dragOffset });
    }
    if (phase !== 'move') this.dragOffset = null;
    return this.dragMoved;
  }

  handleNative({ type, button }, point, { drag, click, openMenu }) {
    // Use the event position. A quick gesture can finish before a renderer round trip.
    if (type === 'mouseDown') {
      this.nativeButton = button;
      if (button === 'left') drag('start', point);
    } else if (type === 'mouseMove') {
      if (this.nativeButton === 'left') drag('move', point);
    } else if (type === 'mouseUp' && this.nativeButton === button) {
      this.nativeButton = null;
      if (button === 'left' && !drag('end', point)) click();
      if (button === 'right') openMenu();
    }
  }
}

module.exports = { WidgetInput };

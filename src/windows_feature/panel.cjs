'use strict';

function panelPosition({ anchor, area, size }) {
  if (!anchor?.width) anchor = null;
  const [width, height] = size;
  const center = anchor ? anchor.x + anchor.width / 2 : area.x + area.width - width / 2 - 16;
  return {
    x: Math.round(Math.max(area.x, Math.min(area.x + area.width - width, center - width / 2))),
    y: Math.round(Math.max(area.y, Math.min(area.y + area.height - height,
      anchor && anchor.y < area.y + area.height / 2 ? area.y + 8 : area.y + area.height - height - 8))),
  };
}

function createPanelController({ window, screen, getAnchorBounds }) {
  function place(anchor) {
    if (window.isDestroyed()) return false;
    const display = anchor?.width ? screen.getDisplayMatching(anchor) : screen.getPrimaryDisplay();
    const position = panelPosition({ anchor, area: display.workArea, size: window.getSize() });
    const [x, y] = window.getPosition();
    if (x !== position.x || y !== position.y) window.setPosition(position.x, position.y);
    return true;
  }
  function show(clickedAnchor) {
    if (!place(clickedAnchor?.getBounds?.() || getAnchorBounds?.() || null)) return false;
    window.show(); window.focus();
    return true;
  }
  function follow(widget) {
    if (window.isDestroyed() || !window.isVisible() || !widget || widget.isDestroyed() || !widget.isVisible()) return false;
    return place(widget.getBounds());
  }
  return { show, follow };
}

module.exports = { panelPosition, createPanelController };

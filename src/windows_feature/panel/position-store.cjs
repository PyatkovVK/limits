'use strict';
const fs = require('node:fs');
const path = require('node:path');

function createPositionStore(root) {
  const file = root && path.join(root, 'windows-panel-position.json');
  return {
    load() {
      if (!file) return null;
      try {
        const { x, y } = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) return { x, y };
      } catch { /* First launch or an invalid preference uses the tray anchor. */ }
      return null;
    },
    save(position) {
      if (!file) return;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.tmp`, JSON.stringify(position));
        fs.renameSync(`${file}.tmp`, file);
      } catch { /* The panel keeps its position in memory if the disk is unavailable. */ }
    },
  };
}

module.exports = { createPositionStore };

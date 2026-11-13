'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Persistence stays independent of BrowserWindow and display placement.
class WidgetPositionStore {
  constructor({ root, fileSystem = fs }) {
    this.file = path.join(root, 'linux-widget-position.json');
    this.fileSystem = fileSystem;
  }

  load() {
    try {
      const saved = JSON.parse(this.fileSystem.readFileSync(this.file, 'utf8'));
      if (Number.isSafeInteger(saved.x) && Number.isSafeInteger(saved.y)) return { x: saved.x, y: saved.y };
    } catch { /* First launch or unavailable storage. */ }
    return null;
  }

  save(position) {
    try {
      this.fileSystem.mkdirSync(path.dirname(this.file), { recursive: true });
      this.fileSystem.writeFileSync(`${this.file}.tmp`, JSON.stringify(position));
      this.fileSystem.renameSync(`${this.file}.tmp`, this.file);
    } catch { /* The widget keeps its position in memory if storage is unavailable. */ }
  }

  clear() {
    try {
      this.fileSystem.rmSync(this.file, { force: true });
    } catch { /* Reset still applies to the current session. */ }
  }
}

module.exports = { WidgetPositionStore };

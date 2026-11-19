'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { AiController } = require('../ai-controller.cjs');
const { displaySchema } = require('../quota-display.cjs');
const { quotaMetrics, snapshotFile } = require('./statusline.cjs');

const scriptFile = 'claude-statusline.cjs';

class ClaudeController extends AiController {
  constructor({ profileId, directory }) {
    super({ providerId: 'claude', profileId });
    this.directory = directory;
    this.account = { type: 'local', id: this.profileId };
    this.publish({ capabilities: { setup: true, signOut: true }, status: 'ready', account: this.account,
      error: 'claudeWaitingForUsage' });
  }

  async connect() {}
  disconnect() {}
  getDisplaySchema(state = this.state) { return displaySchema(state); }

  setup() {
    const file = path.resolve(this.directory, scriptFile);
    fs.copyFileSync(path.join(__dirname, 'statusline.cjs'), file);
    const scriptPath = process.platform === 'win32' ? file.replaceAll('\\', '/') : file;
    // Both PowerShell and Bash preserve JavaScript Unicode escapes inside this argument.
    const quotedPath = scriptPath.replace(/['"\\$`!\x00-\x1f]/g, char =>
      '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
    const command = `node -e "require('${quotedPath}').run().catch(() => { process.exitCode = 1; })"`;
    return JSON.stringify({ statusLine: { type: 'command', command } }, null, 2);
  }

  checkAccess() {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(this.directory, snapshotFile), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const now = Date.now();
    const updatedAt = data?.updatedAt;
    const metrics = Number.isSafeInteger(updatedAt) && updatedAt > 0 && updatedAt <= now
      ? quotaMetrics(data?.limits, now) : [];
    const groups = metrics.length ? [{ id: 'claude', name: 'Claude Code', metrics }] : [];
    return { status: 'ready', account: this.account, capabilities: this.state.capabilities,
      groups, selectedId: groups[0]?.id, updatedAt: groups.length ? updatedAt : null,
      error: groups.length ? null : 'claudeWaitingForUsage' };
  }

  async refresh() {
    try { return this.publish(this.checkAccess()); }
    catch { return this.publish({ status: 'error', error: 'claudeUsageReadFailed' }); }
  }

  async signOut() {
    fs.rmSync(path.join(this.directory, scriptFile), { force: true });
    fs.rmSync(path.join(this.directory, snapshotFile), { force: true });
    this.publish({ status: 'signed-out', account: null, groups: [], updatedAt: null, error: null });
  }
}

module.exports = { ClaudeController };

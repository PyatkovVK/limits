'use strict';
const { AiController } = require('../../src/common/ai-connects/ai-controller.cjs');
class MoneyController extends AiController {
  constructor(options = {}) {
    super({ ...options, providerId: 'test-money', pollIntervalMs: 60000 });
    this.calls = 0; this.generation = 0; this.balance = 12.5;
  }
  async connect() { this.connected = true; }
  async checkAccess() { return { account: { id: 'fixture' }, status: 'ready', capabilities: {} }; }
  async refresh() {
    const generation = this.generation;
    await this.connect(); this.calls++;
    if (this.gate) await this.gate;
    if (generation !== this.generation) return this.state;
    if (this.offline) throw new Error('provider secret must not escape');
    const { account } = await this.checkAccess();
    return this.publish({ account, selectedId: 'wallet', status: 'ready', error: null, updatedAt: Date.now(),
      groups: [{ id: 'wallet', name: 'Wallet', metrics: [{ id: 'balance', type: 'money', semantics: 'balance', value: this.balance, currency: 'USD' },
        { id: 'requests', type: 'count', unit: 'requests', value: 0 }] }] });
  }
  getDisplaySchema() {
    return { layout: 'metrics', primaryMetricId: 'balance', groups: [{ id: 'wallet', metrics: [
      { id: 'balance', label: { en: 'Balance', ru: 'Баланс' } }, { id: 'requests', label: { en: 'Requests', ru: 'Запросы' } }
    ] }] };
  }
  disconnect() { this.generation++; this.connected = false; }
}
module.exports = { MoneyController };

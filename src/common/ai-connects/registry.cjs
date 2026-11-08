'use strict';
const { AiController } = require('./ai-controller.cjs');
const { contractError } = require('./contracts.cjs');

class UnavailableController extends AiController {
  constructor(providerId, profileId) {
    super({ providerId, profileId });
    this.publish({ status: 'unsupported', error: 'providerUnavailable' });
  }
  async connect() {}
  async checkAccess() { return { status: 'unsupported', account: null, capabilities: this.state.capabilities }; }
  async refresh() { return this.state; }
  getDisplaySchema() { return {}; }
  disconnect() {}
}
class ControllerRegistry {
  constructor() { this.providers = new Map(); }
  register(id, { create, connectionOptions = options => options, name = id, authentication }) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || this.providers.has(id) || typeof create !== 'function') throw contractError();
    this.providers.set(id, { create, connectionOptions, name: typeof name === 'string' ? name.slice(0, 80) : id, authentication: authentication === 'api-key' ? authentication : null }); return this;
  }
  has(id) { return this.providers.has(id); }
  list() { return [...this.providers].map(([id, entry]) => ({ id, name: entry.name, ...(entry.authentication ? { authentication: entry.authentication } : {}) })); }
  optionsFor(id, context) { return { ...this.providers.get(id)?.connectionOptions(context), profileId: context.profile.id }; }
  create(id, options = {}) {
    const entry = this.providers.get(id);
    if (!entry) return new UnavailableController(id, options.profileId);
    const controller = entry.create(options);
    if (!(controller instanceof AiController) || controller.providerId !== id) throw contractError();
    return controller;
  }
}
const registry = new ControllerRegistry().register('codex', {
  name: 'ChatGPT (Codex)',
  create: options => require('./codex/controller.cjs').createController(options),
  connectionOptions: context => require('./codex/options.cjs').connectionOptions(context)
}).register('deepseek', {
  name: 'DeepSeek', authentication: 'api-key',
  create: options => new (require('./deepseek/controller.cjs').DeepSeekController)(options),
  connectionOptions: context => require('./deepseek/credentials.cjs').connectionOptions(context)
}).register('zai', {
  name: 'GLM Coding Plan (Z.ai)', authentication: 'api-key',
  create: options => new (require('./zai/controller.cjs').ZaiController)(options),
  connectionOptions: context => require('./api-key-credentials.cjs').keyConnectionOptions(context, 'zai')
});
module.exports = { ControllerRegistry, registry };

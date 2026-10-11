'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Accounts } = require('../src/common/accounts.cjs');
const { Monitor } = require('../src/common/monitor.cjs');
const { CodexClient } = require('../src/common/codex-client.cjs');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
class Client extends EventEmitter {
  constructor() { super(); this.requests = []; this.attempts = 0; }
  async start() { if (this.startGate) await this.startGate.promise; }
  stop() { this.emit('disconnected'); }
  async request(method, params) {
    this.requests.push({ method, params });
    if (method === 'account/read') { if (this.readGate) await this.readGate.promise; return { account: null }; }
    if (method === 'account/login/start') {
      const result = { loginId: `attempt-${++this.attempts}`, authUrl: 'https://auth.openai.com/test' };
      if (this.loginGate) await this.loginGate.promise;
      if (this.completeBeforeResponse) {
        this.emit('notification', 'account/login/completed', { loginId: result.loginId, success: true });
        this.emit('notification', 'account/login/completed', { loginId: 'old-attempt', success: false });
      }
      return result;
    }
    if (method === 'account/login/cancel' && this.cancelGate) await this.cancelGate.promise;
    if (method === 'account/logout' && this.logoutGate) await this.logoutGate.promise;
    return {};
  }
}
function setup(t, createClient = () => new Client()) {
  const parent = path.resolve(__dirname, '../artifacts'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'auth-test-'));
  const accounts = new Accounts({ root, createMonitor: () => new Monitor(createClient()) });
  t.after(() => {
    accounts.stop();
    if (path.dirname(path.resolve(root)) !== parent || !path.basename(root).startsWith('auth-test-')) throw new Error('Unsafe cleanup');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const monitor = accounts.monitors.get('default');
  return { accounts, monitor, client: monitor.client };
}
test('cancel while account read is pending prevents login and keeps the lock until cleanup', async t => {
  const { accounts, monitor, client } = setup(t); client.readGate = deferred();
  const login = accounts.login(); await turn();
  const cancel = accounts.cancelLogin('default');
  const other = accounts.add(); await assert.rejects(accounts.login(other), { code: 'loginBusy' });
  client.readGate.resolve();
  assert.equal(await login, null); await cancel;
  assert.equal(client.attempts, 0); assert.equal(monitor.loginId, null); assert.equal(accounts.loginActive, null);
});
test('cancel while login RPC is pending cancels its returned id and never returns a browser URL', async t => {
  const { accounts, monitor, client } = setup(t); client.loginGate = deferred();
  const login = accounts.login(); await turn();
  assert.equal(client.attempts, 1);
  const cancel = accounts.cancelLogin('default'); client.loginGate.resolve();
  assert.equal(await login, null); await cancel;
  assert.deepEqual(client.requests.filter(r => r.method === 'account/login/cancel').map(r => r.params), [{ loginId: 'attempt-1' }]);
  assert.equal(monitor.loginId, null); assert.equal(accounts.loginActive, null);
});
test('late completion from a cancelled attempt cannot clear its replacement or unlock another profile', async t => {
  const { accounts, monitor, client } = setup(t);
  await accounts.login(); await accounts.login();
  for (const success of [false, true]) client.emit('notification', 'account/login/completed', { loginId: 'attempt-1', success });
  assert.equal(monitor.loginId, 'attempt-2'); assert.equal(accounts.loginActive, 'default'); assert.equal(monitor.state.error, null);
  const other = accounts.add(); await assert.rejects(accounts.login(other), { code: 'loginBusy' });
  client.emit('notification', 'account/login/completed', { loginId: 'attempt-2', success: false });
  assert.equal(accounts.loginActive, null); assert.equal(monitor.loginId, null);
  await accounts.login(other);
});
test('completion delivered before the login response is consumed finishes the correct attempt', async t => {
  const { accounts, monitor, client } = setup(t); client.completeBeforeResponse = true;
  assert.equal(await accounts.login(), null);
  assert.equal(accounts.loginActive, null); assert.equal(monitor.loginId, null);
});
test('concurrent starts of the same profile do not create two remote login attempts', async t => {
  const { accounts, client } = setup(t); client.readGate = deferred();
  const first = accounts.login(); await assert.rejects(accounts.login(), { code: 'loginBusy' });
  client.readGate.resolve(); await first; assert.equal(client.attempts, 1);
});
test('a delayed cancellation cannot release a replacement attempt', async t => {
  const { accounts, monitor, client } = setup(t); await accounts.login();
  client.cancelGate = deferred(); const oldAttempt = accounts.loginAttempt;
  const cancel = accounts.cancelLogin('default'); client.emit('disconnected');
  await accounts.login(); const replacement = accounts.loginAttempt;
  client.cancelGate.resolve(); await cancel;
  await accounts.cancelLogin('default', oldAttempt);
  assert.equal(accounts.loginAttempt, replacement); assert.equal(monitor.loginId, 'attempt-2');
});
test('removing a profile cancels preparation and rejects a new login until logout finishes', async t => {
  const { accounts } = setup(t); const id = accounts.add(); const monitor = accounts.monitors.get(id); const client = monitor.client;
  client.readGate = deferred(); client.logoutGate = deferred();
  const login = accounts.login(id); await turn(); const removal = accounts.remove(id);
  await assert.rejects(accounts.login(id), /Unknown profile/); client.readGate.resolve();
  assert.equal(await login, null); await turn(); assert.equal(client.attempts, 0);
  await assert.rejects(accounts.login(id), /Unknown profile/); client.logoutGate.resolve(); await removal;
  assert.equal(accounts.monitors.has(id), false); assert.equal(accounts.loginActive, null);
});
test('RPC timeout during browser login clears both locks and reconnects as signed-out', async t => {
  const server = `require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
    const m=JSON.parse(line); if(m.method==='initialized'||m.method==='hang')return;
    let result={}; if(m.method==='account/read')result={account:null};
    if(m.method==='account/login/start')result={loginId:'attempt',authUrl:'https://auth.openai.com/test'};
    process.stdout.write(JSON.stringify({id:m.id,result})+'\\n');
  });`;
  const { accounts, monitor } = setup(t, () => new CodexClient(process.execPath, { args: ['-e', server], timeout: 1000 }));
  await accounts.login(); await assert.rejects(monitor.client.request('hang'), /вовремя/);
  assert.equal(monitor.loginId, null); assert.equal(accounts.loginActive, null);
  await monitor.refresh(); assert.equal(monitor.state.status, 'signed-out');
  const other = accounts.add(); assert.equal(await accounts.login(other), 'https://auth.openai.com/test');
});

test('failed remote cancellation closes its server and releases the login lock', async t => {
  const { accounts, monitor, client } = setup(t); await accounts.login();
  const request = client.request.bind(client);
  client.request = async (method, params) => {
    if (method === 'account/login/cancel') throw new Error('cancel failed');
    return request(method, params);
  };
  await assert.rejects(accounts.cancelLogin('default'), /cancel failed/);
  assert.equal(accounts.loginActive, null); assert.equal(monitor.loginId, null);
  await monitor.refresh(); assert.equal(monitor.state.status, 'signed-out');
});

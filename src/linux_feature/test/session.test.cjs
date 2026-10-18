'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { watchSession, screenSaverName } = require('../session.cjs');

function setup(t, extra = {}) {
  const powerMonitor = new EventEmitter();
  powerMonitor.getSystemIdleTime = () => 0;
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => { child.killed = true; child.stdout.end(); child.stderr.end(); };
  let refreshes = 0;
  const dispose = watchSession({ powerMonitor, refresh: () => { refreshes++; }, spawn: () => child, ...extra });
  t.after(dispose);
  return { powerMonitor, child, dispose, count: () => refreshes };
}
const signal = (name, active) => `/org/example/ScreenSaver: ${name}.ActiveChanged (${active},)\n`;

test('Linux recovers on wake and real desktop unlock signals without suspend', t => {
  const { powerMonitor, child, count, dispose } = setup(t);
  powerMonitor.emit('suspend'); powerMonitor.emit('lock-screen');
  assert.equal(count(), 0);
  powerMonitor.emit('resume');
  assert.equal(count(), 1);
  child.stdout.write(signal('org.cinnamon.ScreenSaver', true));
  assert.equal(count(), 1);
  child.stdout.write(signal('org.cinnamon.ScreenSaver', false));
  assert.equal(count(), 2);
  child.stdout.write(signal('org.cinnamon.ScreenSaver', false));
  assert.equal(count(), 2, 'duplicate inactive signals must not reconnect again');
  dispose();
  powerMonitor.emit('resume');
  assert.equal(count(), 2);
  assert.equal(powerMonitor.listenerCount('resume'), 0);
  assert.equal(child.killed, true);
});

test('desktop signals support fragmented lines and unlocking when the watcher started while locked', t => {
  for (const name of ['org.freedesktop.ScreenSaver', 'org.gnome.ScreenSaver', 'org.cinnamon.ScreenSaver', 'org.mate.ScreenSaver', 'org.xfce.ScreenSaver']) {
    const { child, count } = setup(t);
    child.stdout.write('Monitoring signals.\n/org/example: org.example.Unrelated (false,)\n');
    const text = signal(name, false);
    child.stdout.write(text.slice(0, 20));
    assert.equal(count(), 0);
    child.stdout.write(text.slice(20));
    assert.equal(count(), 1);
  }
});

test('desktop selection starts one read-only gdbus monitor without a shell', t => {
  for (const [desktop, name] of [['X-Cinnamon', 'org.cinnamon.ScreenSaver'], ['ubuntu:GNOME', 'org.gnome.ScreenSaver'], ['MATE', 'org.mate.ScreenSaver'], ['XFCE', 'org.xfce.ScreenSaver'], ['KDE', 'org.freedesktop.ScreenSaver'], ['', 'org.freedesktop.ScreenSaver']]) {
    assert.equal(screenSaverName(desktop), name);
    let call;
    setup(t, { env: { XDG_CURRENT_DESKTOP: desktop }, spawn(binary, args, options) {
      call = { binary, args, options };
      throw new Error('Unavailable');
    } });
    assert.equal(call.binary, 'gdbus');
    assert.deepEqual(call.args, ['monitor', '--session', '--dest', name]);
    assert.ok(!call.options.shell);
  }
});

test('gdbus keeps desktop access while AppImage library paths are removed', t => {
  const env = { APPDIR: '/tmp/.mount_Limits', APPIMAGE: '/home/u/Limits.AppImage',
    PATH: '/tmp/.mount_Limits/usr/bin:/usr/bin', LD_LIBRARY_PATH: '/tmp/.mount_Limits/lib',
    DBUS_SESSION_BUS_ADDRESS: 'session', XDG_CURRENT_DESKTOP: 'GNOME' };
  let actual;
  setup(t, { env, spawn(_binary, _args, options) { actual = options.env; throw new Error('Unavailable'); } });
  assert.equal(actual.PATH, '/usr/bin');
  assert.equal(actual.LD_LIBRARY_PATH, undefined);
  assert.equal(actual.APPDIR, undefined);
  assert.equal(actual.DBUS_SESSION_BUS_ADDRESS, 'session');
  assert.equal(actual.XDG_CURRENT_DESKTOP, 'GNOME');
  assert.ok(env.APPDIR, 'the application environment must stay unchanged');
});

test('return from extended idle recovers even if gdbus is missing, then polling stops on dispose', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { powerMonitor, child, count, dispose } = setup(t);
  child.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' }));
  let idle = 3600;
  powerMonitor.getSystemIdleTime = () => idle;
  t.mock.timers.tick(5000);
  assert.equal(count(), 0);
  idle = 0; t.mock.timers.tick(5000);
  assert.equal(count(), 1);
  t.mock.timers.tick(5000); assert.equal(count(), 1);
  dispose(); idle = 3600; t.mock.timers.tick(5000); idle = 0; t.mock.timers.tick(5000);
  assert.equal(count(), 1);
});

test('unsupported idle queries do not interrupt wake recovery', t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { powerMonitor, count } = setup(t);
  powerMonitor.getSystemIdleTime = () => { throw new Error('Unsupported'); };
  t.mock.timers.tick(5000);
  powerMonitor.getSystemIdleTime = () => NaN;
  t.mock.timers.tick(5000);
  assert.equal(count(), 0);
  powerMonitor.emit('resume'); assert.equal(count(), 1);
});

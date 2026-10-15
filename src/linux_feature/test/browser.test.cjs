'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserEnvironment, openBrowser } = require('../browser.cjs');

test('AppImage browser launch preserves desktop session and removes private runtime paths', () => {
  const env = { APPDIR: '/tmp/.mount_Limits', APPIMAGE: '/home/u/Limits.AppImage', ARGV0: 'Limits',
    PATH: '/tmp/.mount_Limits/usr/bin:/usr/bin:/home/u/bin', LD_LIBRARY_PATH: '/tmp/.mount_Limits/lib:/opt/lib',
    LD_PRELOAD: '/tmp/.mount_Limits/lib/hook.so /opt/user.so', DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0', DBUS_SESSION_BUS_ADDRESS: 'session' };
  const clean = browserEnvironment(env);
  assert.equal(clean.PATH, '/usr/bin:/home/u/bin'); assert.equal(clean.LD_LIBRARY_PATH, '/opt/lib');
  assert.equal(clean.LD_PRELOAD, '/opt/user.so');
  for (const key of ['DISPLAY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS']) assert.equal(clean[key], env[key]);
  for (const key of ['APPDIR', 'APPIMAGE', 'ARGV0']) assert.equal(clean[key], undefined);
  assert.ok(env.APPDIR);
  assert.equal(browserEnvironment({ ...env, LD_LIBRARY_PATH_ORIG: '/original' }).LD_LIBRARY_PATH, '/original');
  assert.deepEqual(browserEnvironment({ PATH: '/usr/bin', LD_LIBRARY_PATH: '/opt/lib' }), { PATH: '/usr/bin', LD_LIBRARY_PATH: '/opt/lib' });
});

test('browser URL is passed as a single argument and failed xdg-open falls back to gio', async () => {
  const calls = [], url = 'https://auth.openai.com/authorize?state=a&redirect_uri=http%3A%2F%2Flocalhost';
  await openBrowser(url, { env: { DISPLAY: ':1' }, execute(file, args, options, done) {
    calls.push([file, args]); assert.equal(options.env.DISPLAY, ':1'); assert.equal(options.timeout, 15000);
    done(file === 'xdg-open' ? new Error('missing') : null);
  } });
  assert.deepEqual(calls, [['xdg-open', [url]], ['gio', ['open', url]]]);
  await assert.rejects(openBrowser(url, { execute(_file, _args, _options, done) { done(new Error(url)); } }), error => !error.message.includes(url));
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { watchSession } = require('../session.cjs');

test('macOS resume and unlock coalesce into one recovery and stop removes listeners', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const powerMonitor = new EventEmitter();
  let recoveries = 0;
  const stop = watchSession({ powerMonitor, refresh: () => recoveries++ });
  powerMonitor.emit('resume'); powerMonitor.emit('unlock-screen');
  t.mock.timers.tick(249); assert.equal(recoveries, 0);
  t.mock.timers.tick(1); assert.equal(recoveries, 1);
  powerMonitor.emit('unlock-screen');
  t.mock.timers.tick(250); assert.equal(recoveries, 2);
  powerMonitor.emit('resume'); stop(); stop();
  t.mock.timers.tick(1000); assert.equal(recoveries, 2);
  assert.equal(powerMonitor.listenerCount('resume'), 0);
  assert.equal(powerMonitor.listenerCount('unlock-screen'), 0);
});

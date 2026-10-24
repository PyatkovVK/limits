'use strict';

// Reconnect aborts requests left awaiting pre-sleep sockets and preserves sign-in.
function watchSession({ powerMonitor, refresh, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let stopped = false;
  const recover = () => {
    if (stopped) return;
    clearTimer(timer);
    timer = setTimer(() => { timer = null; if (!stopped) refresh(); }, 250);
    timer?.unref?.();
  };
  for (const event of ['resume', 'unlock-screen']) powerMonitor.on(event, recover);
  return () => {
    stopped = true;
    clearTimer(timer);
    for (const event of ['resume', 'unlock-screen']) powerMonitor.removeListener(event, recover);
  };
}

module.exports = { watchSession };

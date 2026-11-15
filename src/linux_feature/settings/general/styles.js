'use strict';

(function (root) {
  const tray = Object.freeze(['classic', 'digits', 'rings']);
  const panel = Object.freeze(['line', 'shelf']);
  const available = xfce => xfce ? [...tray, ...panel] : tray;
  const normalize = (value, xfce) => available(xfce).includes(value) ? value : 'classic';
  const api = { tray, panel, available, normalize };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsLinuxTrayStyle = api;
})(globalThis);

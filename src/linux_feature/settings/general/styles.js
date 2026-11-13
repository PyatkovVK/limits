'use strict';

(function (root) {
  const styles = Object.freeze(['bar', 'classic']);
  const normalize = value => styles.includes(value) ? value : 'classic';
  const api = { styles, normalize };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsLinuxTrayStyle = api;
})(globalThis);

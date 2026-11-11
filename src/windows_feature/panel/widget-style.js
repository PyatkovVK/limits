'use strict';
(function (root) {
  const styles = ['classic', 'rows', 'cells'];
  const normalize = value => styles.includes(value) ? value : 'classic';
  const api = { styles, normalize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.limitsWindowsWidgetStyle = api;
})(globalThis);

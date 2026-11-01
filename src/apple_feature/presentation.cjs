'use strict';

const isNotchMode = mode => ['notch', 'island'].includes(mode);
const displayModes = available => available ? ['tray', 'notch', 'island'] : ['tray'];

// null leaves delivery to the existing system notification path.
function notify(mode, notch, message) {
  return mode === 'island' ? notch?.notify(message) || false : null;
}
function offerUpdate(mode, notch, offer, t) {
  if (mode !== 'island') return false;
  notch?.notify({ title: t('islandUpdate'), body: `${t('islandVersion')} ${offer.version}`, action: 'updates' });
  return true;
}
module.exports = { isNotchMode, displayModes, notify, offerUpdate };

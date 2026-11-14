'use strict';

function offerSignIn(accounts, showPanel) {
  let prompted = false;
  accounts.on('state', state => {
    if (prompted || state.status !== 'signed-out') return;
    prompted = true;
    void showPanel();
  });
}

module.exports = { offerSignIn };

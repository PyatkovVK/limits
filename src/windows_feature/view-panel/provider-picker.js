'use strict';

window.renderReady.then(async () => {
  const picker = document.createElement('div');
  picker.id = 'provider-picker';
  picker.hidden = true;
  const select = document.createElement('select');
  select.id = 'provider-picker-select';
  const placeholder = new Option('', '', true, true);
  placeholder.disabled = true;
  placeholder.hidden = true;
  select.append(placeholder);
  picker.append(select);
  document.getElementById('login').after(picker);

  select.onchange = () => {
    const id = select.value;
    select.value = '';
    if (id) void window.addAccount(id);
  };
  let providerList;

  function renderPicker(next) {
    const providers = next.providers || [];
    picker.hidden = next.demo || !next.readOnly || next.status !== 'signed-out' || !providers.length;
    select.disabled = Boolean(next.loginProfileId || next.keyConnection);
    const label = window.limitsWindowsI18n.t(next.language, 'chooseProvider');
    placeholder.textContent = label;
    select.setAttribute('aria-label', label);
    const signature = JSON.stringify(providers);
    if (signature === providerList) return;
    providerList = signature;
    select.replaceChildren(placeholder, ...providers.map(({ id, name }) => new Option(name, id)));
    select.value = '';
  }

  window.limits.subscribe(renderPicker);
  renderPicker(await window.limits.get());
});

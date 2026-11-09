'use strict';

/**
 * @typedef {{ id: string, title: string, description: string, disabled?: boolean, hidden?: boolean }} SettingBase
 * @typedef {{ value: string, label: string }} SelectOption
 * @typedef {SettingBase & { kind: 'select', value: string, options: readonly SelectOption[], onChange: (value: string) => Promise<void> }} SelectSetting
 * @typedef {SettingBase & { kind: 'toggle', value: boolean, onChange: (value: boolean) => Promise<void> }} ToggleSetting
 * @typedef {SelectSetting | ToggleSetting} Setting
 */

/**
 * Groups keep the same setting IDs and kinds between renders.
 * @typedef {{ id: string, title: string, settings: readonly Setting[] }} SettingsGroup
 */

(() => {
  function add(parent, tag, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    parent.append(element);
    return element;
  }

  function updateText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  /** @param {Setting} setting */
  function createRow(parent, setting) {
    const toggle = setting.kind === 'toggle';
    const row = add(parent, 'div', 'settings-item');
    const copy = add(row, 'div', 'settings-item-copy');
    const title = add(copy, 'label');
    title.htmlFor = setting.id;
    const description = add(copy, 'p', 'settings-item-description');
    description.id = `${setting.id}-description`;
    const control = toggle
      ? add(row, 'input', 'settings-item-toggle')
      : add(add(row, 'div', 'settings-item-select'), 'select');
    control.id = setting.id;
    control.setAttribute('aria-describedby', description.id);
    if (toggle) {
      control.type = 'checkbox';
      control.setAttribute('role', 'switch');
    }
    const error = add(row, 'p', 'settings-item-error');
    error.setAttribute('role', 'status');

    let current = setting;
    let pending = false;
    let failed = false;
    let failureText;
    function sync() {
      control.disabled = pending || Boolean(current.disabled);
      if (!pending) {
        if (toggle) control.checked = current.value;
        else control.value = current.value;
      }
      updateText(error, failed ? failureText : '');
    }
    control.addEventListener('change', async () => {
      if (pending || control.disabled) return;
      const value = toggle ? control.checked : control.value;
      pending = true;
      failed = false;
      sync();
      try { await current.onChange(value); }
      catch { failed = true; }
      finally { pending = false; sync(); }
    });

    return (next, message) => {
      current = next;
      failureText = message;
      row.hidden = Boolean(next.hidden);
      updateText(title, next.title);
      updateText(description, next.description);
      if (next.kind === 'select') {
        const options = next.options;
        if (control.options.length !== options.length || options.some(({ value, label }, index) =>
          control.options[index].value !== value || control.options[index].textContent !== label)) {
          const selected = control.value;
          control.replaceChildren(...options.map(({ value, label }) => new Option(label, value)));
          if (pending && options.some(option => option.value === selected)) control.value = selected;
        }
      }
      sync();
    };
  }

  /** @param {SettingsGroup} group */
  function create(group) {
    const section = document.createElement('section');
    section.className = 'settings-group';
    const heading = add(section, 'h3');
    heading.id = `${group.id}-title`;
    section.setAttribute('aria-labelledby', heading.id);
    const card = add(section, 'div', 'settings-group-card');
    const rows = new Map(group.settings.map(setting => [setting.id, createRow(card, setting)]));
    /** @param {SettingsGroup} next */
    function update(next, error) {
      updateText(heading, next.title);
      for (const setting of next.settings) rows.get(setting.id)(setting, error);
    }
    return { section, update };
  }

  window.limitsSettingsGroup = { create };
})();

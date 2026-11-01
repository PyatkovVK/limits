'use strict';
const { contractError } = require('../contracts.cjs');
const fields = [
  ['total_balance', 'Общий баланс', 'Total balance', 'Баланс', 'Balance'],
  ['granted_balance', 'Бонусные средства', 'Granted balance', 'Бонус', 'Bonus'],
  ['topped_up_balance', 'Пополненные средства', 'Topped-up balance', 'Пополнено', 'Paid']
];
function amount(value) {
  if (typeof value !== 'string' || value.length > 80 || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeBalance(raw) {
  if (!raw || typeof raw.is_available !== 'boolean' || !Array.isArray(raw.balance_infos)) throw contractError('balanceRefreshFailed');
  const seen = new Set();
  const groups = raw.balance_infos.slice(0, 16).filter(info => {
    if (!['USD', 'CNY'].includes(info?.currency) || seen.has(info.currency)) return false;
    seen.add(info.currency); return true;
  }).map(info => ({ id: `balance-${info.currency.toLowerCase()}`, name: `DeepSeek · ${info.currency}`,
    metrics: fields.map(([id]) => ({ id, type: 'money', semantics: 'balance', currency: info.currency, value: amount(info[id]) })) }));
  return { groups, accountAvailable: raw.is_available };
}
function displaySchema(state) {
  return { layout: 'metrics', primaryMetricId: 'total_balance', groups: (state.groups || []).map(group => ({ id: group.id,
    metrics: fields.map(([id, ru, en, compactRu, compactEn]) => ({ id, label: { ru, en }, compactLabel: { ru: compactRu, en: compactEn } })) })) };
}
module.exports = { normalizeBalance, displaySchema, amount };

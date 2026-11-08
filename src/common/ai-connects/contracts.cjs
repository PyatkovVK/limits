'use strict';
const text = value => typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const time = value => number(value) !== null && value > 0 && value < 8640000000000000 ? value : null;
const captions = value => ({ ru: text(value?.ru) || '', en: text(value?.en) || '' });
const safeCodes = new Set(['disconnected', 'refreshFailed', 'loginIncomplete', 'providerUnavailable', 'unsupported', 'loginBusy', 'loginUnavailable', 'accountActionFailed', 'controllerContract', 'invalidApiKey', 'credentialStorageUnavailable', 'balanceRefreshFailed', 'quotaRefreshFailed', 'codingPlanRequired', 'browserOpenFailed']);
function contractError(code = 'controllerContract') { return Object.assign(new Error(code), { code }); }
function diagnostic(info) {
  return { stage: ['connect', 'access', 'refresh', 'signIn', 'signOut', 'disconnect'].includes(info?.stage) ? info.stage : 'refresh',
    code: number(info?.code) ?? (['Error', 'TypeError', 'TimeoutError', ...safeCodes].includes(info?.code) ? info.code : 'operationFailed') };
}
function unique(values, convert) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).slice(0, 128).map(convert).filter(value => {
    if (!value?.id || seen.has(value.id)) return false;
    seen.add(value.id); return true;
  });
}
function metric(raw) {
  const type = ['percentage', 'money', 'count'].includes(raw?.type) ? raw.type : null;
  if (!type) return null;
  let value = number(raw.value);
  const currency = /^[A-Z]{3}$/.test(raw.currency || '') ? raw.currency : null;
  const unit = text(raw.unit);
  if (type === 'percentage' && value !== null && (value < 0 || value > 100)) value = null;
  if ((type === 'money' && !currency) || (type === 'count' && !unit)) value = null;
  return { id: text(raw.id), type, value, semantics: ['remaining', 'used', 'balance'].includes(raw.semantics) ? raw.semantics : 'remaining',
    currency, unit, total: number(raw.total) > 0 ? raw.total : null, resetsAt: time(raw.resetsAt), durationSeconds: number(raw.durationSeconds) > 0 ? raw.durationSeconds : null };
}
function snapshot(raw = {}) {
  const account = raw.account && { type: text(raw.account.type), id: text(raw.account.id), email: text(raw.account.email), planType: text(raw.account.planType) };
  const displaySchema = { layout: raw.displaySchema?.layout === 'quota-windows' ? 'quota-windows' : 'metrics', primaryMetricId: text(raw.displaySchema?.primaryMetricId),
    groups: unique(raw.displaySchema?.groups, group => ({ id: text(group?.id), metrics: unique(group?.metrics, item => ({ id: text(item?.id), label: captions(item?.label), compactLabel: captions(item?.compactLabel),
      slot: ['short', 'weekly'].includes(item?.slot) ? item.slot : null })) })) };
  return { providerId: text(raw.providerId), profileId: text(raw.profileId), account: account || null, accountAvailable: typeof raw.accountAvailable === 'boolean' ? raw.accountAvailable : null,
    groups: unique(raw.groups, group => ({ id: text(group?.id), name: text(group?.name) || '', plan: text(group?.plan), metrics: unique(group?.metrics, metric) })),
    selectedId: text(raw.selectedId), updatedAt: time(raw.updatedAt), refreshing: Boolean(raw.refreshing),
    status: ['connecting', 'ready', 'signed-out', 'signing-in', 'unsupported', 'error'].includes(raw.status) ? raw.status : 'connecting',
    error: safeCodes.has(raw.error) ? raw.error : raw.error ? 'refreshFailed' : null,
    capabilities: { signIn: raw.capabilities?.signIn === true, cancelSignIn: raw.capabilities?.cancelSignIn === true, signOut: raw.capabilities?.signOut === true, apiKey: raw.capabilities?.apiKey === true }, displaySchema };
}
module.exports = { snapshot, contractError, diagnostic };

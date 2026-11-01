'use strict';
const { normalizeLimits, windowView } = require('./ai-connects/codex/limits.cjs');
function selectedBucket(state) {
  return state.buckets?.find(bucket => bucket.id === state.selectedId) || state.buckets?.[0] || null;
}
function isStale(state, now = Date.now()) {
  return Boolean(state.error || !state.updatedAt || now - state.updatedAt > (state.staleAfterMs || 90000));
}
module.exports = { normalizeLimits, windowView, selectedBucket, isStale };

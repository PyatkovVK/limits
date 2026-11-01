'use strict';

const releasePattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?$/;
const exactRelease = branch => releasePattern.exec(branch)?.[0] === branch;

function selectPipeline({ eventName, ref = '', payload = {} }) {
  const isPull = eventName === 'pull_request';
  const branch = isPull ? payload.pull_request?.head.ref || '' :
    ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : '';
  const active = ['push', 'workflow_dispatch', 'pull_request'].includes(eventName) &&
    payload.deleted !== true && branch !== '';
  const numeric = exactRelease(branch);
  const demo = branch === 'demo' || (branch.endsWith('-demo') && exactRelease(branch.slice(0, -5)));
  const check = active && (branch === 'main' || demo);
  const build = active && !check;
  const publish = build && numeric && !isPull;
  const version = build && numeric ? (branch.split('.').length === 2 ? `${branch}.0` : branch) : '';
  return { check, build, publish, branch, version, tag: publish ? `v${branch}` : '' };
}

function route({ context, core }) {
  const plan = selectPipeline(context);
  for (const [key, value] of Object.entries(plan)) core.setOutput(key, String(value));
  core.info(!plan.check && !plan.build ? `Skipping ${context.ref}.` :
    plan.check ? `Running tests only for ${plan.branch}.` :
      `Testing, building and verifying ${plan.branch}; publication: ${plan.publish}.`);
}

module.exports = { selectPipeline, route };

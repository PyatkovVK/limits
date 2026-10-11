'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const gate = new AsyncFunction('context', 'core', workflow.jobs['check-branch'].steps[0].with.script);

async function checkBranch(ref, payload = {}) {
  const outputs = {};
  await gate({ ref, payload }, {
    setOutput: (key, value) => { outputs[key] = value; },
    info: () => {},
  });
  return outputs;
}

test('release gate allows main and exact numeric version branches', async () => {
  assert.deepEqual(await checkBranch('refs/heads/main'), {
    build: 'true', branch: 'main', version: '', tag: 'latest', prerelease: 'true',
  });
  for (const [branch, version] of [['1.0', '1.0.0'], ['2.1', '2.1.0'], ['2.1.3', '2.1.3'], ['0.6', '0.6.0'], ['10.20.30', '10.20.30']]) {
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`), {
      build: 'true', branch, version, tag: `v${branch}`, prerelease: 'false',
    });
  }
});

test('other branches, tags and branch deletions exit successfully without building', async () => {
  for (const branch of ['create-mvp', 'develop', 'feature/2.1', 'release/2.1', 'fix-1.0', 'v2.1', '2', '2.1-beta', '2.1.3.4', '02.1', 'main/feature', '2.1\n']) {
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`), { build: 'false' }, branch);
  }
  assert.deepEqual(await checkBranch('refs/tags/2.1'), { build: 'false' });
  assert.deepEqual(await checkBranch('refs/tags/main'), { build: 'false' });
  assert.deepEqual(await checkBranch('refs/heads/2.1', { deleted: true }), { build: 'false' });
  assert.deepEqual(await checkBranch('refs/heads/main', { deleted: true }), { build: 'false' });
});

test('all push branches reach the gate, and builds and publication require its approval', () => {
  assert.deepEqual(workflow.on.push.branches, ['**']);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.jobs.build.needs, 'check-branch');
  assert.equal(workflow.jobs.build.if, "needs.check-branch.outputs.build == 'true'");
  assert.deepEqual(workflow.jobs.publish.needs, ['check-branch', 'build']);
  assert.equal(workflow.jobs.publish.if, "needs.check-branch.outputs.build == 'true'");
  // The only job on an unrelated branch performs no checkout or dependency install.
  assert.equal(workflow.jobs['check-branch'].steps.length, 1);
});

test('every release OS runs the full portable test suite', () => {
  const runTests = workflow.jobs.build.steps.find(step => step.name === 'Run tests');
  assert.equal(runTests.run, 'npm test');
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'win'));
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'mac'));
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'linux'));
});

test('release tag points to the built commit on both initial and repeated publication', async () => {
  const tagStep = workflow.jobs.publish.steps.find(step => step.name === 'Point the release tag at the built commit');
  const updateTag = new AsyncFunction('context', 'github', 'process', tagStep.with.script);
  const context = { repo: { owner: 'owner', repo: 'limits' }, sha: 'built-commit' };
  for (const tag of ['latest', 'v2.1']) {
    for (const exists of [true, false]) {
      const calls = [];
      const github = { rest: { git: {
        getRef: async args => {
          calls.push(['get', args]);
          if (!exists) throw Object.assign(new Error('Not found'), { status: 404 });
        },
        createRef: async args => { calls.push(['create', args]); },
        updateRef: async args => { calls.push(['update', args]); },
      } } };
      await updateTag(context, github, { env: { RELEASE_TAG: tag } });
      assert.deepEqual(calls[1], exists
        ? ['update', { ...context.repo, ref: `tags/${tag}`, sha: context.sha, force: true }]
        : ['create', { ...context.repo, ref: `refs/tags/${tag}`, sha: context.sha }]);
    }
  }
  await assert.rejects(updateTag(context, { rest: { git: {
    getRef: async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }); },
  } } }, { env: { RELEASE_TAG: 'latest' } }), /Forbidden/);
});

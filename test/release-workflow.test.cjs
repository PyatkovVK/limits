'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const gate = new AsyncFunction('context', 'core', workflow.jobs['check-branch'].steps[0].with.script);

async function checkBranch(ref, payload = {}, eventName = 'push') {
  const outputs = {};
  await gate({ ref, payload, eventName }, {
    setOutput: (key, value) => { outputs[key] = value; },
    info: () => {},
  });
  return outputs;
}

test('main builds and verifies packages without creating a release or tag', async () => {
  for (const event of ['push', 'workflow_dispatch']) {
    assert.deepEqual(await checkBranch('refs/heads/main', {}, event), {
      build: 'true', publish: 'false', check: 'false', branch: 'main', version: '', tag: '', prerelease: 'false',
    });
  }
});

test('release gate publishes exact numeric version branches', async () => {
  for (const [branch, version] of [['1.4', '1.4.0'], ['2.1', '2.1.0'], ['3.0', '3.0.0'], ['2.1.3', '2.1.3'], ['0.6', '0.6.0'], ['10.20.30', '10.20.30']]) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), {
        build: 'true', publish: 'true', check: 'false', branch, version, tag: `v${branch}`, prerelease: 'false',
      });
    }
  }
});

test('all version-demo branches run the full package pipeline without publication', async () => {
  for (const [branch, version] of [['1.1-demo', '1.1.0'], ['1.3-demo', '1.3.0'], ['1.4-demo', '1.4.0'], ['2.0-demo', '2.0.0'], ['3.10.2-demo', '3.10.2']]) {
    const expected = { build: 'true', publish: 'false', check: 'false', branch, version, tag: '', prerelease: 'false' };
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), expected);
    }
    const payload = { pull_request: { base: { ref: 'main' }, head: { ref: branch } } };
    assert.deepEqual(await checkBranch('refs/pull/10/merge', payload, 'pull_request'), expected);
  }
});

test('ordinary branches run portable tests on every OS without packaging or uploads', () => {
  assert.equal(workflow.jobs.check.needs, 'check-branch');
  assert.equal(workflow.jobs.check.if, "needs.check-branch.outputs.check == 'true'");
  assert.deepEqual(workflow.jobs.check.strategy.matrix.os, ['windows-latest', 'macos-15', 'ubuntu-24.04']);
  assert.ok(workflow.jobs.check.steps.some(step => step.run === 'npm test'));
  assert.ok(workflow.jobs.check.steps.every(step => !/upload-artifact|release|build:/.test(step.uses || step.run || '')));
  assert.equal(workflow.jobs['check-branch'].outputs.check, '${{ steps.branch.outputs.check }}');
});

test('pull requests use the source branch and cannot publish, including numeric sources', async () => {
  for (const base of ['main', '1.4-demo', '2.0', 'develop']) {
    for (const [branch, build, version] of [['codex/feature', false, ''], ['1.0-fix', false, ''], ['main', true, ''], ['1.4', true, '1.4.0'], ['2.0.1-demo', true, '2.0.1']]) {
      const payload = { pull_request: { base: { ref: base }, head: { ref: branch } } };
      assert.deepEqual(await checkBranch('refs/pull/2/merge', payload, 'pull_request'), {
        build: String(build), publish: 'false', check: String(!build), branch, version, tag: '', prerelease: 'false',
      });
    }
  }
});

test('every other branch runs tests, with no legacy or partial-name build exceptions', async () => {
  for (const branch of ['create-mvp', 'develop', 'feature/2.1', 'release/2.1', 'fix-1.0', '1.0-fix', '1.0-fix/feature', '1.0-fix\n', 'v2.1', '2', '2.1-beta', '2.1.3.4', '02.1', '1.04-demo', 'main/feature', '2.1\n', '1.4-demo\n', '1.4-demo-feature', 'feature/1.4-demo', '1.x', '1.x-demo']) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), {
        build: 'false', publish: 'false', check: 'true', branch, version: '', tag: '', prerelease: 'false',
      }, branch);
    }
  }
});

test('tags, deleted branches and unsupported events do not test, build or publish', async () => {
  const inactive = { build: 'false', publish: 'false', check: 'false', version: '', tag: '', prerelease: 'false' };
  for (const ref of ['refs/tags/2.1', 'refs/tags/main', 'refs/pull/2/merge']) {
    assert.deepEqual(await checkBranch(ref), { ...inactive, branch: '' });
    assert.deepEqual(await checkBranch(ref, {}, 'workflow_dispatch'), { ...inactive, branch: '' });
  }
  for (const branch of ['main', '1.4', '1.4-demo', 'codex/feature']) {
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`, { deleted: true }), { ...inactive, branch });
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, 'pull_request_target'), { ...inactive, branch });
  }
  assert.deepEqual(await checkBranch('refs/pull/2/merge', {}, 'pull_request'), { ...inactive, branch: '' });
});

test('all push branches reach the gate, and builds and publication require its approval', () => {
  assert.deepEqual(workflow.on.push.branches, ['**']);
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.ok(Object.hasOwn(workflow.on, 'pull_request'));
  assert.equal(workflow.on.pull_request, null);
  assert.equal(workflow.jobs.build.needs, 'check-branch');
  assert.equal(workflow.jobs.build.if, "needs.check-branch.outputs.build == 'true'");
  assert.deepEqual(workflow.jobs.verify.needs, ['check-branch', 'build']);
  assert.equal(workflow.jobs.verify.if, "needs.check-branch.outputs.build == 'true'");
  assert.deepEqual(workflow.jobs.publish.needs, ['check-branch', 'verify']);
  assert.equal(workflow.jobs.publish.if, "needs.check-branch.outputs.publish == 'true'");
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  for (const job of ['check-branch', 'check', 'build', 'verify']) assert.equal(workflow.jobs[job].permissions, undefined);
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'write' });
  assert.equal(workflow.jobs['check-branch'].outputs.publish, '${{ steps.branch.outputs.publish }}');
  const save = workflow.jobs.verify.steps.find(step => step.name === 'Save checksums');
  assert.equal(save.with.name, 'packages-checksums');
  assert.equal(save.with.path, 'release/SHA256SUMS.txt');
  assert.equal(save.with['retention-days'], 7);
  const download = workflow.jobs.publish.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
  assert.equal(download.with.pattern, 'packages-*');
  assert.equal(download.with['merge-multiple'], true);
});

test('every release OS runs the full portable test suite', () => {
  const runTests = workflow.jobs.build.steps.find(step => step.name === 'Run tests');
  assert.equal(runTests.run, 'npm test');
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'win'));
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'mac'));
  assert.ok(workflow.jobs.build.strategy.matrix.include.some(target => target.target === 'linux'));
});

test('CI uses explicit package scripts for every target and keeps local publication disabled', () => {
  const pkg = require('../package.json');
  const { buildPlan } = require('../scripts/build-plan.cjs');
  const matrix = workflow.jobs.build.strategy.matrix.include;
  assert.deepEqual(matrix.map(target => target.script), ['build:win:x64', 'build:mac:arm64', 'build:mac:x64', 'build:linux:x64']);
  for (const { target, arch, script } of matrix) {
    assert.ok(pkg.scripts[script], script);
    if (target === 'win') {
      assert.equal(pkg.scripts[script], 'npm run build:win');
      continue;
    }
    const [command, entrypoint, platform, flag] = pkg.scripts[script].split(' ');
    assert.equal(command, 'node');
    assert.equal(entrypoint, 'scripts/build.cjs');
    assert.equal(platform, target);
    assert.deepEqual(buildPlan(platform, [flag], { platform: target === 'mac' ? 'darwin' : 'linux' }).args,
      [`--${target}`, `--${arch}`, '--publish=never']);
  }
  assert.equal(workflow.jobs.build.steps.find(step => step.name === 'Build packages').run, 'npm run "$BUILD_SCRIPT"');
});

test('publication expects the filenames electron-builder generates for all eight packages', () => {
  const pkg = require('../package.json');
  // Initialize the public entrypoint before loading packager classes with cyclic imports.
  require('app-builder-lib');
  const { PlatformPackager } = require('app-builder-lib/out/platformPackager');
  const { Arch } = require('builder-util');
  const definitions = [
    ['win', 'portable', 'exe', Arch.x64], ['win', 'nsis', 'exe', Arch.x64],
    ['mac', 'dmg', 'dmg', Arch.arm64], ['mac', 'zip', 'zip', Arch.arm64],
    ['mac', 'dmg', 'dmg', Arch.x64], ['mac', 'zip', 'zip', Arch.x64],
    ['linux', 'appImage', 'AppImage', Arch.x64], ['linux', 'deb', 'deb', Arch.x64],
  ];
  const actual = definitions.map(([platform, target, extension, arch]) => {
    const packager = Object.create(PlatformPackager.prototype);
    Object.defineProperties(packager, {
      config: { value: pkg.build },
      platformSpecificBuildOptions: { value: pkg.build[platform] },
      platform: { value: { buildConfigurationKey: platform } },
      appInfo: { value: { version: pkg.version, name: pkg.name, productName: pkg.build.productName, sanitizedProductName: pkg.build.productName } },
    });
    return packager.expandArtifactNamePattern(pkg.build[target], extension, arch);
  });
  const script = workflow.jobs.verify.steps.find(step => step.name === 'Verify all packages and calculate checksums').run;
  const list = /packages=\(([\s\S]*?)\)/.exec(script)[1];
  const expected = [...list.matchAll(/"([^"]+)"/g)].map(match => match[1].replaceAll('$version', pkg.version));
  assert.deepEqual(expected.sort(), actual.sort());
});

test('release builds allow absent certificates and receive signing secrets only in the packaging step', () => {
  const step = workflow.jobs.build.steps.find(item => item.name === 'Build packages');
  assert.equal(step.env.CODEX_LIMITS_RELEASE, '1');
  assert.equal(step.env.CODEX_LIMITS_ALLOW_UNSIGNED, '1');
  assert.ok(step.env.WIN_CSC_LINK.includes('secrets.WIN_CSC_LINK'));
  assert.ok(step.env.CSC_LINK.includes('secrets.MAC_CSC_LINK'));
  for (const key of ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) assert.ok(step.env[key].includes(`secrets.${key}`));
  for (const value of Object.values(step.env).filter(value => value.includes('secrets.'))) {
    assert.ok(value.includes("github.event_name != 'pull_request'"));
  }
  assert.equal(workflow.jobs.build.env.CSC_LINK, undefined);
  assert.equal(workflow.jobs.build.env.CODEX_LIMITS_ALLOW_UNSIGNED, undefined);
});

test('release tag points to the built commit on both initial and repeated publication', async () => {
  const tagStep = workflow.jobs.publish.steps.find(step => step.name === 'Point the release tag at the built commit');
  const updateTag = new AsyncFunction('context', 'github', 'process', tagStep.with.script);
  const context = { repo: { owner: 'owner', repo: 'limits' }, sha: 'built-commit' };
  for (const tag of ['v1.0', 'v2.1']) {
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
  } } }, { env: { RELEASE_TAG: 'v1.0' } }), /Forbidden/);
});

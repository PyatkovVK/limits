'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { packageNames } = require('../scripts/ci/packages.cjs');
const updateTag = require('../scripts/ci/tag.cjs');

const root = path.resolve(__dirname, '..');
const load = name => yaml.load(fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8'));
const workflow = load('release.yml');
const checks = load('ci-tests.yml');
const builds = load('ci-build.yml');
const verification = load('ci-verify.yml');
const publication = load('ci-publish.yml');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const gate = new AsyncFunction('require', 'context', 'core',
  workflow.jobs['check-branch'].steps.find(step => step.id === 'branch').with.script);

async function checkBranch(ref, payload = {}, eventName = 'push') {
  const outputs = {};
  await gate(name => require(path.join(root, name)), { ref, payload, eventName }, {
    setOutput: (key, value) => { outputs[key] = value; }, info: () => {},
  });
  return outputs;
}

test('main and exact demo branches run only tests on pushes and manual runs', async () => {
  for (const branch of ['main', 'demo', '1.1-demo', '1.2-demo', '1.3-demo', '1.4-demo', '2.0-demo', '3.10.2-demo']) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), {
        check: 'true', build: 'false', publish: 'false', branch, version: '', tag: '',
      });
    }
  }
});

test('exact numeric branches retain builds and release publication for every version', async () => {
  for (const [branch, version] of [['1.1', '1.1.0'], ['1.2', '1.2.0'], ['1.3', '1.3.0'], ['1.4', '1.4.0'], ['2.1', '2.1.0'], ['3.0', '3.0.0'], ['2.1.3', '2.1.3'], ['0.6', '0.6.0'], ['10.20.30', '10.20.30']]) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), {
        check: 'false', build: 'true', publish: 'true', branch, version, tag: `v${branch}`,
      });
    }
  }
});

test('all other branch names build every platform without publication', async () => {
  for (const branch of ['limits/rework-ci', 'create-mvp', 'develop', 'feature/2.1', 'release/2.1', 'fix-1.0', '1.0-fix', '1.0-fix/feature', 'v2.1', '2', '2.1-beta', '2.1.3.4', '02.1', '1.04-demo', 'main/feature', '2.1\n', '2.1\r', '1.4-demo\n', '1.4-demo-feature', 'feature/1.4-demo', '1.x', '1.x-demo', 'demo/feature', 'demo-feature']) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, event), {
        check: 'false', build: 'true', publish: 'false', branch, version: '', tag: '',
      }, branch);
    }
  }
});

test('PR source names select the pipeline independently of the target and never publish', async () => {
  for (const base of ['main', 'demo', '1.4-demo', '2.0', 'develop']) {
    for (const [branch, build, version] of [['limits/feature', true, ''], ['main', false, ''], ['demo', false, ''], ['1.4', true, '1.4.0'], ['2.0.1-demo', false, '']]) {
      const payload = { pull_request: { base: { ref: base }, head: { ref: branch } } };
      assert.deepEqual(await checkBranch('refs/pull/2/merge', payload, 'pull_request'), {
        check: String(!build), build: String(build), publish: 'false', branch, version, tag: '',
      });
    }
  }
});

test('tags, deleted branches and unsupported events cannot start any pipeline', async () => {
  const inactive = { check: 'false', build: 'false', publish: 'false', version: '', tag: '' };
  for (const ref of ['refs/tags/2.1', 'refs/tags/main', 'refs/pull/2/merge']) {
    for (const event of ['push', 'workflow_dispatch']) {
      assert.deepEqual(await checkBranch(ref, {}, event), { ...inactive, branch: '' });
    }
  }
  for (const branch of ['main', 'demo', '1.4', '1.4-demo', 'limits/feature']) {
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`, { deleted: true }), { ...inactive, branch });
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, 'schedule'), { ...inactive, branch });
    assert.deepEqual(await checkBranch(`refs/heads/${branch}`, {}, 'pull_request_target'), { ...inactive, branch });
  }
  assert.deepEqual(await checkBranch('refs/pull/2/merge', {}, 'pull_request'), { ...inactive, branch: '' });
});

test('entrypoint gates reusable workflows and failed builds block verification and publication', () => {
  assert.deepEqual(workflow.on, { push: { branches: ['**'] }, workflow_dispatch: null, pull_request: null });
  assert.deepEqual(workflow.concurrency, { group: '${{ github.workflow }}-${{ github.ref }}', 'cancel-in-progress': false });
  for (const job of ['check', 'build']) {
    assert.equal(workflow.jobs[job].needs, 'check-branch');
    assert.equal(workflow.jobs[job].if, `needs.check-branch.outputs.${job} == 'true'`);
  }
  assert.deepEqual(workflow.jobs.verify.needs, ['check-branch', 'build']);
  assert.equal(workflow.jobs.verify.if, undefined);
  assert.deepEqual(workflow.jobs.publish.needs, ['check-branch', 'verify']);
  assert.equal(workflow.jobs.publish.if, "needs.check-branch.outputs.publish == 'true'");
  for (const [job, name] of [['check', 'ci-tests.yml'], ['build', 'ci-build.yml'], ['verify', 'ci-verify.yml'], ['publish', 'ci-publish.yml']]) {
    assert.equal(workflow.jobs[job].uses, `./.github/workflows/${name}`);
    assert.deepEqual(Object.keys(load(name).on), ['workflow_call']);
  }
  for (const doc of [workflow, checks, builds, verification]) assert.deepEqual(doc.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.publish.permissions, { contents: 'write' });
  assert.deepEqual(publication.permissions, { contents: 'write' });
});

test('test-only pipeline runs common and native suites on all three OSes without packages or uploads', () => {
  const { strategy, steps } = checks.jobs.test;
  assert.deepEqual(strategy.matrix.include, [
    { os: 'windows-latest', target: 'win' }, { os: 'macos-15', target: 'mac' }, { os: 'ubuntu-24.04', target: 'linux' },
  ]);
  assert.deepEqual(steps.filter(step => step.run).map(step => [step.run, step.if]), [
    ['npm run test:common', undefined], ['npm run test:${{ matrix.target }}', undefined],
  ]);
  assert.ok(steps.every(step => !step.uses?.includes('upload-artifact')));
});

test('every package target runs tests before its explicit native build command', () => {
  const pkg = require('../package.json');
  const { buildPlan } = require('../scripts/build/build-plan.cjs');
  const matrix = builds.jobs.build.strategy.matrix.include;
  assert.deepEqual(matrix.map(({ os, target, script }) => [os, target, script]), [
    ['windows-latest', 'win', 'build:win:x64'], ['macos-15', 'mac', 'build:mac:arm64'],
    ['macos-15-intel', 'mac', 'build:mac:x64'], ['ubuntu-24.04', 'linux', 'build:linux:x64'],
  ]);
  for (const { target, arch, script } of matrix) {
    assert.ok(pkg.scripts[script], script);
    if (target === 'win') { assert.equal(pkg.scripts[script], 'npm run build:win'); continue; }
    const [, entrypoint, flag] = pkg.scripts[script].split(' ');
    assert.equal(entrypoint, `scripts/build/${target}.cjs`);
    assert.deepEqual(buildPlan(target, [flag], { platform: target === 'mac' ? 'darwin' : 'linux' }).args,
      [`--${target}`, `--${arch}`, '--publish=never']);
  }
  const steps = builds.jobs.build.steps;
  const buildIndex = steps.findIndex(step => step.name === 'Build packages');
  assert.deepEqual(steps.slice(0, buildIndex).filter(step => step.run?.startsWith('npm run ')).map(step => [step.run, step.if]), [
    ['npm run test:common', undefined], ['npm run test:${{ matrix.target }}', undefined],
  ]);
  assert.equal(steps.find(step => step.name === 'Build packages').run, 'npm run "$BUILD_SCRIPT"');
  assert.equal(steps.find(step => step.name === 'Set version from the branch').if, "env.RELEASE_VERSION != ''");
});

test('artifacts include four package groups and checksums, retained for seven days', () => {
  const save = builds.jobs.build.steps.find(step => step.name === 'Save packages');
  assert.equal(save.with.name, 'packages-${{ matrix.target }}-${{ matrix.arch }}');
  assert.equal(save.with['retention-days'], 7);
  assert.equal(save.with['if-no-files-found'], 'error');
  assert.equal(verification.jobs.verify.steps.find(step => step.name === 'Verify all packages and calculate checksums').run,
    'node scripts/ci/packages.cjs');
  const checksums = verification.jobs.verify.steps.find(step => step.name === 'Save checksums');
  assert.deepEqual(checksums.with, { name: 'packages-checksums', path: 'release/SHA256SUMS.txt', 'if-no-files-found': 'error', 'retention-days': 7 });
  for (const job of [verification.jobs.verify, publication.jobs.publish]) {
    const download = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    assert.deepEqual(download.with, { pattern: 'packages-*', path: 'release', 'merge-multiple': true });
  }
});

test('expected package names match electron-builder outputs for all eight packages', () => {
  const pkg = require('../package.json');
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
      config: { value: pkg.build }, platformSpecificBuildOptions: { value: pkg.build[platform] },
      platform: { value: { buildConfigurationKey: platform } },
      appInfo: { value: { version: pkg.version, name: pkg.name, productName: pkg.build.productName, sanitizedProductName: pkg.build.productName } },
    });
    return packager.expandArtifactNamePattern(pkg.build[target], extension, arch);
  });
  assert.deepEqual(packageNames(pkg.version).sort(), actual.sort());
});

test('only numeric publication builds can expose signing secrets during packaging', () => {
  assert.equal(workflow.jobs.build.with.sign, "${{ needs.check-branch.outputs.publish == 'true' }}");
  assert.equal(builds.on.workflow_call.inputs.sign.default, false);
  const step = builds.jobs.build.steps.find(item => item.name === 'Build packages');
  assert.equal(step.env.CODEX_LIMITS_RELEASE, '1');
  assert.equal(step.env.CODEX_LIMITS_ALLOW_UNSIGNED, '1');
  const secrets = Object.values(step.env).filter(value => value.includes('secrets.'));
  assert.equal(secrets.length, 7);
  for (const value of secrets) {
    assert.ok(value.includes('inputs.sign &&'));
    assert.ok(value.includes("github.event_name != 'pull_request'"));
  }
  assert.equal(builds.jobs.build.env.CSC_LINK, undefined);
  for (const job of Object.values(builds.jobs)) {
    for (const other of job.steps.filter(item => item !== step)) assert.ok(!JSON.stringify(other).includes('secrets.'));
  }
});

test('release tags follow the built commit and forbidden events cannot update refs', async () => {
  for (const branch of ['1.0', '2.1']) {
    for (const eventName of ['push', 'workflow_dispatch']) {
      for (const exists of [true, false]) {
        const context = { repo: { owner: 'owner', repo: 'limits' }, sha: 'built-commit', eventName, ref: `refs/heads/${branch}` };
        const calls = [];
        const github = { rest: { git: {
          getRef: async args => { calls.push(['get', args]); if (!exists) throw Object.assign(new Error('Not found'), { status: 404 }); },
          createRef: async args => { calls.push(['create', args]); }, updateRef: async args => { calls.push(['update', args]); },
        } } };
        await updateTag({ context, github });
        assert.deepEqual(calls[1], exists
          ? ['update', { ...context.repo, ref: `tags/v${branch}`, sha: context.sha, force: true }]
          : ['create', { ...context.repo, ref: `refs/tags/v${branch}`, sha: context.sha }]);
      }
    }
  }
  for (const branch of ['main', 'demo', '1.4-demo', 'limits/feature']) {
    await assert.rejects(updateTag({ context: { eventName: 'push', ref: `refs/heads/${branch}` } }), /Only numeric/);
  }
  await assert.rejects(updateTag({ context: { eventName: 'pull_request', payload: { pull_request: { head: { ref: '1.4' } } } } }), /Only numeric/);
  await assert.rejects(updateTag({ context: { eventName: 'push', ref: 'refs/heads/1.4' }, github: { rest: { git: {
    getRef: async () => { throw Object.assign(new Error('Forbidden'), { status: 403 }); },
  } } } }), /Forbidden/);
});

test('workflow and action files remain small with orchestration rather than embedded programs', () => {
  const github = path.join(root, '.github');
  for (const file of fs.readdirSync(github, { recursive: true }).filter(file => /\.ya?ml$/.test(file))) {
    const text = fs.readFileSync(path.join(github, file), 'utf8');
    assert.ok(text.trimEnd().split('\n').length <= 100, `${file} exceeds 100 lines`);
  }
  const files = ['release.yml', 'ci-tests.yml', 'ci-build.yml', 'ci-verify.yml', 'ci-publish.yml'];
  for (const file of files) {
    for (const job of Object.values(load(file).jobs)) {
      for (const step of job.steps || []) {
        for (const script of [step.run, step.with?.script].filter(Boolean)) assert.ok(!script.includes('\n'), `${file} embeds a program`);
        if (step.uses?.startsWith('actions/checkout@')) assert.equal(step.with['persist-credentials'], false);
      }
    }
  }
  const setup = yaml.load(fs.readFileSync(path.join(root, '.github/actions/setup/action.yml'), 'utf8'));
  assert.equal(setup.runs.steps[0].with['node-version'], '22');
  assert.equal(setup.runs.steps[0].with['package-manager-cache'], false);
  assert.equal(setup.runs.steps[1].run, 'npm install --no-audit --no-fund');
});

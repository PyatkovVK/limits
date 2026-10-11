'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const pkg = require('../package.json');

const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/release.yml'), 'utf8'));
const steps = workflow.jobs.publish.steps;
const verification = steps.find(step => step.name === 'Verify all packages and calculate checksums').run;
const publication = steps.find(step => step.name === 'Create or update the release and upload packages').run;
const bash = process.platform === 'win32'
  ? path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git', 'bin', 'bash.exe') : '/bin/bash';
const options = { skip: !fs.existsSync(bash) && 'Bash is required to run the actual release workflow scripts' };
const packageList = /packages=\(([\s\S]*?)\)/.exec(verification)[1];
const packageNames = version => [...packageList.matchAll(/"([^"]+)"/g)].map(match => match[1].replaceAll('$version', version));
const shellPath = value => process.platform === 'win32'
  ? `/${value[0].toLowerCase()}${value.slice(2).replaceAll('\\', '/')}` : value;

function fixture(version, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-release-test-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: pkg.version }));
    fs.mkdirSync(path.join(root, 'release'));
    for (const name of packageNames(version || pkg.version)) {
      fs.writeFileSync(path.join(root, 'release', name), `Package fixture: ${name}\n`);
    }
    const env = { ...process.env, RELEASE_VERSION: version, RUNNER_TEMP: shellPath(root), GH_TOKEN: '' };
    // macOS provides shasum; production verification runs on Ubuntu with sha256sum.
    const checksumFallback = 'if ! command -v sha256sum >/dev/null; then sha256sum() { shasum -a 256 "$@"; }; fi\n';
    const run = (script, extra = {}) => spawnSync(bash, ['--noprofile', '--norc', '-eo', 'pipefail', '-c', checksumFallback + script], {
      cwd: root, env: { ...env, ...extra }, encoding: 'utf8', windowsHide: true
    });
    callback(root, run);
  } finally {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('limits-release-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

test('actual publication preflight verifies eight packages and hashes main and overridden versions', options, () => {
  for (const version of ['', '2.1.0']) fixture(version, (root, run) => {
    const result = run(verification);
    assert.equal(result.status, 0, result.stderr);
    const lines = fs.readFileSync(path.join(root, 'release', 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 8);
    for (const [index, name] of packageNames(version || pkg.version).entries()) {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'release', name))).digest('hex');
      // GNU checksums use a binary marker on Windows and a text marker on Unix.
      assert.match(lines[index], /^[a-f0-9]{64} [ *]/);
      assert.equal(lines[index].slice(0, 64), hash);
      assert.equal(lines[index].slice(66), name);
    }
  });
});

test('actual publication preflight rejects missing and empty packages before writing checksums', options, () => {
  for (const empty of [false, true]) fixture('', (root, run) => {
    const name = packageNames(pkg.version).find(name => name.endsWith('.AppImage'));
    const file = path.join(root, 'release', name);
    if (empty) fs.writeFileSync(file, '');
    else fs.unlinkSync(file);
    const result = run(verification);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`Missing or empty package: ${name}`));
    assert.equal(fs.existsSync(path.join(root, 'release', 'SHA256SUMS.txt')), false);
  });
});

test('actual release script uploads all packages and checksums before publishing new or existing drafts', options, () => {
  const mockGh = `
    gh() {
      printf '%s\\0' "$@" >> "$GH_TEST_CALLS"
      printf '\\n' >> "$GH_TEST_CALLS"
      if [[ "$2" == 'view' ]]; then [[ "$GH_TEST_EXISTS" == '1' ]]; return; fi
      if [[ "$2" == 'upload' && "$GH_TEST_UPLOAD_FAIL" == '1' ]]; then return 13; fi
      return 0
    }
  `;
  for (const branch of ['main', '2.1']) {
    for (const exists of [false, true]) {
      for (const uploadFail of [false, true]) fixture(branch === 'main' ? '' : '2.1.0', (root, run) => {
        assert.equal(run(verification).status, 0);
        const tag = branch === 'main' ? 'latest' : `v${branch}`;
        const callFile = path.join(root, 'gh-calls');
        const result = run(`${mockGh}\n${publication}`, {
          RELEASE_BRANCH: branch, RELEASE_TAG: tag, RELEASE_PRERELEASE: String(branch === 'main'),
          GITHUB_SHA: 'built-commit', GH_TEST_CALLS: shellPath(callFile),
          GH_TEST_EXISTS: exists ? '1' : '0', GH_TEST_UPLOAD_FAIL: uploadFail ? '1' : '0'
        });
        assert.equal(result.status, uploadFail ? 13 : 0, result.stderr);
        const calls = fs.readFileSync(callFile, 'utf8').trimEnd().split('\n').map(line => line.split('\0').slice(0, -1));
        assert.deepEqual(calls.map(call => call[1]), ['view', exists ? 'edit' : 'create', 'upload', ...(!uploadFail ? ['edit'] : [])]);
        assert.ok(calls.every(call => call[0] === 'release' && call[2] === tag));
        assert.ok(calls[1].includes('--draft'));
        assert.ok(calls[1].includes(`--prerelease=${branch === 'main'}`));
        if (!exists) {
          assert.ok(calls[1].includes('--verify-tag'));
          assert.ok(calls[1].includes('built-commit'));
        }
        const files = [...packageNames(branch === 'main' ? pkg.version : '2.1.0'), 'SHA256SUMS.txt'].map(name => `release/${name}`).sort();
        assert.deepEqual(calls[2].slice(3, -1), files);
        assert.equal(calls[2].at(-1), '--clobber');
        if (!uploadFail) assert.deepEqual(calls[3], ['release', 'edit', tag, '--draft=false']);
        const notes = fs.readFileSync(path.join(root, 'release-notes.md'), 'utf8');
        assert.ok(notes.includes(`branch \`${branch}\``));
        assert.ok(notes.includes('Commit: built-commit'));
      });
    }
  }
});

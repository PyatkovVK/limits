'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { packageNames } = require('../scripts/ci/packages.cjs');
const pkg = require('../package.json');

const verification = path.resolve(__dirname, '../scripts/ci/packages.cjs');
const publication = fs.readFileSync(path.resolve(__dirname, '../scripts/ci/publish.sh'), 'utf8');
const bash = process.platform === 'win32'
  ? path.join(process.env.ProgramFiles || 'C:/Program Files', 'Git', 'bin', 'bash.exe') : '/bin/bash';
const bashOptions = { skip: !fs.existsSync(bash) && 'Bash is required to run the publication script' };
const shellPath = value => process.platform === 'win32'
  ? `/${value[0].toLowerCase()}${value.slice(2).replaceAll('\\', '/')}` : value;

function fixture(version, callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'limits-release-test-'));
  try {
    fs.mkdirSync(path.join(root, 'release'));
    for (const name of packageNames(version || pkg.version)) {
      fs.writeFileSync(path.join(root, 'release', name), `Package fixture: ${name}\n`);
    }
    const env = { ...process.env, RELEASE_VERSION: version, RUNNER_TEMP: shellPath(root), GH_TOKEN: '' };
    const options = { cwd: root, env, encoding: 'utf8', windowsHide: true };
    const verify = () => spawnSync(process.execPath, [verification], options);
    const run = (script, extra = {}) => spawnSync(bash, ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {
      ...options, env: { ...env, ...extra },
    });
    callback(root, verify, run);
  } finally {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('limits-release-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

test('package preflight hashes all eight packages with package.json or a release version', () => {
  for (const version of ['', '1.4.0', '2.1.0', '3.10.2']) fixture(version, (root, verify) => {
    const result = verify();
    assert.equal(result.status, 0, result.stderr);
    const lines = fs.readFileSync(path.join(root, 'release', 'SHA256SUMS.txt'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 8);
    for (const [index, name] of packageNames(version || pkg.version).entries()) {
      const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'release', name))).digest('hex');
      assert.equal(lines[index], `${hash}  ${name}`);
    }
  });
});

test('package preflight rejects any missing, empty or non-file package before writing checksums', () => {
  for (const name of packageNames(pkg.version)) {
    for (const kind of ['missing', 'empty', 'directory']) fixture('', (root, verify) => {
      const file = path.join(root, 'release', name);
      if (kind === 'empty') fs.writeFileSync(file, '');
      else { fs.unlinkSync(file); if (kind === 'directory') fs.mkdirSync(file); }
      const result = verify();
      assert.notEqual(result.status, 0);
      assert.ok(result.stderr.includes(`Missing or empty package: ${name}`), result.stderr);
      assert.equal(fs.existsSync(path.join(root, 'release', 'SHA256SUMS.txt')), false);
    });
  }
});

test('release script uploads packages and checksums before publishing new or existing drafts', bashOptions, () => {
  const mockGh = `
    gh() {
      printf '%s\\0' "$@" >> "$GH_TEST_CALLS"
      printf '\\n' >> "$GH_TEST_CALLS"
      if [[ "$2" == 'view' ]]; then [[ "$GH_TEST_EXISTS" == '1' ]]; return; fi
      if [[ "$2" == 'upload' && "$GH_TEST_UPLOAD_FAIL" == '1' ]]; then return 13; fi
      return 0
    }
  `;
  for (const branch of ['1.0', '2.1']) {
    for (const exists of [false, true]) {
      for (const uploadFail of [false, true]) fixture(`${branch}.0`, (root, verify, run) => {
        assert.equal(verify().status, 0);
        const tag = `v${branch}`;
        const callFile = path.join(root, 'gh-calls');
        const result = run(`${mockGh}\n${publication}`, {
          RELEASE_BRANCH: branch, RELEASE_TAG: tag, GITHUB_SHA: 'built-commit',
          GH_TEST_CALLS: shellPath(callFile), GH_TEST_EXISTS: exists ? '1' : '0', GH_TEST_UPLOAD_FAIL: uploadFail ? '1' : '0',
        });
        assert.equal(result.status, uploadFail ? 13 : 0, result.stderr);
        const calls = fs.readFileSync(callFile, 'utf8').trimEnd().split('\n').map(line => line.split('\0').slice(0, -1));
        assert.deepEqual(calls.map(call => call[1]), ['view', exists ? 'edit' : 'create', 'upload', ...(!uploadFail ? ['edit'] : [])]);
        assert.ok(calls.every(call => call[0] === 'release' && call[2] === tag));
        assert.ok(calls[1].includes('--draft'));
        assert.ok(calls[1].includes('--prerelease=false'));
        if (!exists) { assert.ok(calls[1].includes('--verify-tag')); assert.ok(calls[1].includes('built-commit')); }
        const files = [...packageNames(`${branch}.0`), 'SHA256SUMS.txt'].map(name => `release/${name}`).sort();
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

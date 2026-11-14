'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const vm = require('node:vm');
const { getFileMatchers } = require('app-builder-lib/out/fileMatcher');
const pkg = require('../package.json');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const platforms = { win32: ['win', 'windows_feature'], darwin: ['mac', 'apple_feature'], linux: ['linux', 'linux_feature'] };
const features = fs.readdirSync(src, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name.endsWith('_feature')).map(entry => entry.name);
const sourceFiles = fs.readdirSync(src, { withFileTypes: true, recursive: true })
  .filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name));
const owner = file => path.relative(src, file).split(path.sep)[0];
const generatedHelpers = {
  apple_feature: path.join(root, 'build/apple-screen-info'),
  windows_feature: path.join(root, 'build/taskbar-helper.exe'),
};

function* localReferences(source, extension) {
  if (['.js', '.cjs', '.mjs'].includes(extension)) {
    for (const [, , target] of source.matchAll(/\b(?:require(?:\.resolve)?|import)\s*\(\s*(['"])([^'"\r\n]+)\1/g)) {
      if (target.startsWith('.')) yield target;
    }
    for (const [, , target] of source.matchAll(/\b(?:import|export)\s+(?:[^;'"()]*?\s+from\s+)?(['"])([^'"\r\n]+)\1/g)) {
      if (target.startsWith('.')) yield target;
    }
    for (const [, args] of source.matchAll(/\bpath\.(?:join|resolve)\(\s*__dirname\s*,\s*((?:['"][^'"\r\n]+['"]\s*,?\s*)+)\)/g)) {
      yield path.join(...Array.from(args.matchAll(/(['"])([^'"]+)\1/g), match => match[2]));
    }
  }
  if (extension === '.html' || extension === '.css') {
    const pattern = extension === '.html' ? /\b(?:src|href)\s*=\s*(['"])([^'"\r\n]+)\1/g
      : /(?:@import\s+|url\(\s*)(['"]?)([^'"\s)]+)\1/g;
    for (const [, , target] of source.matchAll(pattern)) {
      if (!/^(?:[\w+.-]+:|#|\/\/)/.test(target)) yield target;
    }
  }
}

test('common and platform implementations keep local dependencies within their boundary', () => {
  for (const file of sourceFiles) {
    const from = owner(file);
    if (from !== 'common' && !features.includes(from)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const ref of localReferences(source, path.extname(file))) {
      const target = path.resolve(path.dirname(file), ref);
      // The shared Codex client reads product version metadata.
      if (target === path.join(root, 'package.json') && from === 'common') continue;
      if (target === generatedHelpers[from]) continue;
      assert.ok(['common', from].includes(owner(target)), `${path.relative(root, file)} loads ${ref}`);
    }
    if (from === 'common' && /\.[cm]?js$/.test(file)) {
      assert.doesNotMatch(source, /\b(?:limitsWindows|limitsApple|limitsLinux)\w*\b/, path.relative(root, file));
    }
  }
});

test('application and build preparation load only the active platform', async t => {
  for (const [platform, [target, feature]] of Object.entries(platforms)) {
    await t.test(platform, async () => {
      const options = { defaultSrc: root, globalOutDir: path.join(root, 'release'),
        customBuildOptions: pkg.build[target], macroExpander: value => value };
      const [matcher] = getFileMatchers(pkg.build, 'files', options.globalOutDir, options);
      const inPackage = matcher.createFilter();
      const app = new EventEmitter();
      const stopped = new Error('Panel loaded');
      const handlers = new Map();
      let setup;
      const electron = {
        app: Object.assign(app, {
          getLocale: () => 'en', getPath: () => root, getVersion: () => pkg.version,
          setPath() {}, setName() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => true,
          dock: { hide() {} },
          whenReady: () => ({ then(fn) { setup = fn; return Promise.resolve(); } }),
        }),
        BrowserWindow: class extends EventEmitter {
          webContents = Object.assign(new EventEmitter(), {
            mainFrame: {}, setWindowOpenHandler() {}, setZoomFactor() {},
            session: { registerPreloadScript: ({ filePath }) => assert.ok(inPackage(filePath, fs.statSync(filePath))) },
          });
          getSize() { return [400, 590]; }
          async loadFile(file) {
            assert.ok(inPackage(file, fs.statSync(file)));
            const assets = handlers.get('limits:platform-assets')({ sender: this.webContents, senderFrame: this.webContents.mainFrame });
            assert.ok(assets.styles.length && assets.scripts.length);
            for (const asset of [...assets.styles, ...assets.scripts]) {
              const assetFile = path.resolve(path.dirname(file), asset);
              assert.equal(owner(assetFile), feature);
              assert.ok(inPackage(assetFile, fs.statSync(assetFile)), asset);
            }
            throw stopped;
          }
        },
        screen: Object.assign(new EventEmitter(), { getPrimaryDisplay: () => ({ workArea: { height: 768 } }) }),
        nativeImage: { createFromPath: () => ({ resize() {} }) },
        nativeTheme: new EventEmitter(),
        ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      };
      const filename = path.join(src, 'main.cjs');
      const realRequire = createRequire(filename);
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        __dirname: src, process: { platform, argv: ['electron', '.'], env: {} }, console,
        require(spec) {
          if (spec === 'electron') return electron;
          if (spec.startsWith('.')) {
            const dependency = realRequire.resolve(spec);
            assert.ok(inPackage(dependency, fs.statSync(dependency)), `${platform} loads ${spec}`);
          }
          return realRequire(spec);
        },
      });
      await assert.rejects(setup, error => error === stopped);

      const preload = path.join(src, 'common/preload.cjs');
      assert.ok(inPackage(preload, fs.statSync(preload)));
      for (const file of sourceFiles) {
        const layer = owner(file);
        if (features.includes(layer) && layer !== feature) {
          assert.equal(inPackage(file, fs.statSync(file)), false, file);
        } else if (layer === 'common' || layer === feature) {
          const relative = path.relative(path.join(src, layer), file).split(path.sep);
          if (!['native', 'scripts', 'test'].includes(relative[0]) && path.extname(file) !== '.md') {
            assert.ok(inPackage(file, fs.statSync(file)), file);
          }
        }
      }

      const prepared = [];
      vm.runInNewContext(fs.readFileSync(path.join(root, 'scripts/prepare-app.cjs'), 'utf8'), {
        process: { platform }, require(spec) { prepared.push(spec); return { buildHelper() {} }; },
      });
      const helper = { win32: 'build-taskbar-helper', darwin: 'build-helper' }[platform];
      assert.deepEqual(prepared, ['./assets.cjs', ...(helper ? [`../src/${feature}/scripts/${helper}.cjs`] : [])]);
    });
  }
});

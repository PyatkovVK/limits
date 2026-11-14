'use strict';
require('./assets.cjs');
if (process.platform === 'win32') require('../src/windows_feature/scripts/build-taskbar-helper.cjs');
if (process.platform === 'darwin') require('../src/apple_feature/scripts/build-helper.cjs').buildHelper();

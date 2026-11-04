const readline = require('node:readline');
let count = 0;
readline.createInterface({ input: process.stdin }).on('line', () => {
  if (process.argv.includes('--input-only')) {
    process.stdout.write(JSON.stringify({ input: { type: 'mouseDown', button: 'left', x: 240, y: 1040 } }) + '\n');
    return;
  }
  if (++count > 1 && process.argv.includes('--hang-after-first')) return;
  process.stdout.write(JSON.stringify({ available: true, visible: true, fullscreen: false, bar: { x: 0, y: 1032, width: 1920, height: 48 } }) + '\n');
});

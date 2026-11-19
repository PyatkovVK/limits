'use strict';
function buildPlan(target, flags = [], { platform = process.platform, arch = process.arch } = {}) {
  const hosts = { mac: 'darwin', linux: 'linux' };
  if (!hosts[target]) throw new Error('Choose mac or linux. For Windows use npm run build:win.');
  if (platform !== hosts[target]) throw new Error(`Run npm run build:${target} on ${target === 'mac' ? 'macOS' : 'Linux'}.`);
  if (flags.length > 1 || flags.some(flag => !['--arm64', '--x64'].includes(flag))) throw new Error('Optional architecture: --arm64 or --x64.');
  const selected = flags[0]?.slice(2) || arch;
  if (!['arm64', 'x64'].includes(selected)) throw new Error('Supported architectures: arm64 and x64.');
  return { arch: selected, args: [`--${target}`, `--${selected}`, '--publish=never'] };
}
module.exports = { buildPlan };

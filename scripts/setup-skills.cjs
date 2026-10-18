'use strict';
const fs = require('node:fs');
const path = require('node:path');

function setupSkills(root = path.resolve(__dirname, '..')) {
  const templates = path.join(root, 'docs', 'skill-templates');
  const local = path.join(root, 'skills');
  const names = [];
  fs.mkdirSync(local, { recursive: true });
  const catalog = path.join(templates, 'README.md');
  if (fs.existsSync(catalog)) fs.cpSync(catalog, path.join(local, 'README.md'), { force: false });
  for (const entry of fs.readdirSync(templates, { withFileTypes: true })) {
    if (!entry.isDirectory() || !fs.existsSync(path.join(templates, entry.name, 'SKILL.md'))) continue;
    fs.cpSync(path.join(templates, entry.name), path.join(local, entry.name), { recursive: true, force: false });
    names.push(entry.name);
  }
  return names;
}

if (require.main === module) {
  const names = setupSkills();
  console.log(`Local skills ready: ${names.join(', ')}. Existing local files were preserved.`);
}
module.exports = { setupSkills };

'use strict';
const { selectPipeline } = require('./route.cjs');

module.exports = async function updateTag({ context, github }) {
  const plan = selectPipeline(context);
  if (!plan.publish) throw new Error('Only numeric branch pushes and manual runs may publish.');
  const ref = `tags/${plan.tag}`;
  try {
    await github.rest.git.getRef({ ...context.repo, ref });
  } catch (error) {
    if (error.status !== 404) throw error;
    await github.rest.git.createRef({ ...context.repo, ref: `refs/${ref}`, sha: context.sha });
    return;
  }
  await github.rest.git.updateRef({ ...context.repo, ref, sha: context.sha, force: true });
};

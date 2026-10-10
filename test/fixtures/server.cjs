const readline = require('node:readline');
readline.createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialized') return;
  if (message.method === 'hang') return;
  if (message.method === 'die') return process.exit(0);
  if (message.method === 'fail') return process.stdout.write(JSON.stringify({ id: message.id, error: { code: -32000, message: 'failure' } }) + '\n');
  process.stdout.write(JSON.stringify({ id: message.id, result: { method: message.method } }) + '\n');
  if (message.method === 'notify') process.stdout.write(JSON.stringify({ method: 'account/rateLimits/updated', params: { rateLimits: {} } }) + '\n');
});

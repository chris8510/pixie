'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, exec } = require('child_process');

const run = (cmd, input) => new Promise((resolve, reject) => {
  const child = exec(cmd, { shell: '/bin/sh', timeout: 5000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  child.stdin.end(input);
});
const hooks = require('../src/hooks');
const { createServer } = require('../src/server');
const { StateStore } = require('../src/state');

test('install keeps foreign hooks, is idempotent, migrates old entries, uninstalls cleanly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixie-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({
    model: 'opus',
    hooks: {
      Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }],
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "/old/hooks/claude-pet-hook.js"' }] }],
    },
  }));
  hooks.install({ port: 4000, file });
  hooks.install({ port: 4000, file });
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(s.model, 'opus');
  assert.strictEqual(s.hooks.Stop.length, 2);
  assert.strictEqual(s.hooks.PreToolUse.length, 1);
  assert.match(s.hooks.PreToolUse[0].hooks[0].command, /127\.0\.0\.1:4000\/event/);
  assert.ok(hooks.isInstalled(file));

  hooks.install({ port: 4000, file, remove: true });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(after, { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } });
  assert.strictEqual(hooks.isInstalled(file), false);
});

test('invalid settings JSON is not overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixie-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{ broken');
  assert.throws(() => hooks.install({ port: 1, file }), /not valid JSON/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ broken');
});

test('the real curl hook command reaches the server', { timeout: 20000 }, async (t) => {
  // Claude Code runs hooks through a POSIX shell (Git Bash on Windows); test that path where it exists.
  if (process.platform === 'win32') return t.skip('needs a POSIX shell');
  try { execSync('curl --version', { stdio: 'ignore' }); } catch { return t.skip('curl not installed'); }
  const store = new StateStore();
  const server = createServer(store);
  t.after(() => server.close());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const event = JSON.stringify({
    hook_event_name: 'PreToolUse', session_id: 'abc', cwd: '/p/web-app',
    tool_name: 'Write', tool_input: { file_path: '/p/web-app/a.js', content: 'x'.repeat(200000) },
  });
  const out = await run(hooks.hookCommand(port), event);
  assert.strictEqual(out, '', 'hook must print nothing');
  assert.strictEqual(store.snapshot().message, 'Writing a.js');
  assert.strictEqual(store.snapshot().project, 'web-app');

  // without the header (e.g. a website) the server refuses
  const res = await fetch(`http://127.0.0.1:${port}/state`, { method: 'POST', body: '{"state":"error"}' });
  assert.strictEqual(res.status, 403);
  await new Promise((r) => server.close(r));

  // pet not running: still silent and successful
  const quiet = await run(hooks.hookCommand(port), event);
  assert.strictEqual(quiet, '');
});

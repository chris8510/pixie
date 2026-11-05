'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Run a hook handler the way Claude Code does in exec form: no shell, event JSON on stdin.
const runHook = (handler, input) => new Promise((resolve) => {
  const child = spawn(handler.command, handler.args, { shell: false });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', (code) => resolve({ code, out }));
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
  const h = s.hooks.PreToolUse[0].hooks[0];
  assert.strictEqual(h.command, 'curl');
  assert.ok(h.args.includes('http://127.0.0.1:4000/event'));
  assert.strictEqual(h.async, true, 'must never block Claude Code');
  assert.ok(!JSON.stringify(h).includes('||'), 'no shell syntax');
  assert.ok(hooks.isInstalled(file));

  hooks.install({ port: 4000, file, remove: true });
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepStrictEqual(after, { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] } });
  assert.strictEqual(hooks.isInstalled(file), false);
});

test('hooks from older versions (shell syntax) are detected and replaced', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixie-'));
  const file = path.join(dir, 'settings.json');
  const old = 'curl -s -m 1 -X POST -H "Content-Type: application/json" -H "X-Pixie: 1" --data-binary @- http://127.0.0.1:47821/event || true';
  fs.writeFileSync(file, JSON.stringify({ hooks: Object.fromEntries(hooks.EVENTS.map((ev) => [ev, [{ hooks: [{ type: 'command', command: old, timeout: 5 }] }]])) }));
  assert.ok(hooks.isOutdated(47821, file));
  hooks.install({ port: 47821, file });
  assert.strictEqual(hooks.isOutdated(47821, file), false);
  assert.ok(hooks.isInstalled(file));
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(hooks.EVENTS.every((ev) => s.hooks[ev].length === 1 && s.hooks[ev][0].hooks[0].command === 'curl'));
  assert.ok(hooks.isOutdated(50000, file), 'a different port counts as outdated');
});

test('invalid settings JSON is not overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixie-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{ broken');
  assert.throws(() => hooks.install({ port: 1, file }), /not valid JSON/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ broken');
});

test('the real hook (curl, exec form, no shell) reaches the server', { timeout: 20000 }, async (t) => {
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
  const { out } = await runHook(hooks.hookHandler(port), event);
  assert.strictEqual(out, '', 'hook must print nothing');
  assert.strictEqual(store.snapshot().message, 'Writing a.js');
  assert.strictEqual(store.snapshot().project, 'web-app');

  // without the header (e.g. a website) the server refuses
  const res = await fetch(`http://127.0.0.1:${port}/state`, { method: 'POST', body: '{"state":"error"}' });
  assert.strictEqual(res.status, 403);
  await new Promise((r) => server.close(r));

  // pet not running: silent and quick (async in Claude Code, so a non-zero exit can't block anything)
  const started = Date.now();
  const quiet = await runHook(hooks.hookHandler(port), event);
  assert.strictEqual(quiet.out, '');
  assert.ok(Date.now() - started < 3000);
});

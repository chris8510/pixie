'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { StateStore, describeTool, translateNotification } = require('../src/state');
const { translator, pickLanguage } = require('../src/i18n');

const de = translator('de');
const ev = (name, extra = {}) => ({ hook_event_name: name, session_id: 's1', cwd: '/x/my-app', ...extra });

test('maps a typical turn', () => {
  const s = new StateStore({ t: de });
  s.handleHookEvent(ev('UserPromptSubmit', { prompt: 'Baue   einen Login-Dialog' }));
  assert.deepStrictEqual(s.snapshot(), { state: 'thinking', message: 'Denke nach…', task: 'Baue einen Login-Dialog', project: 'my-app', active: 1 });
  s.handleHookEvent(ev('PreToolUse', { tool_name: 'Edit', tool_input: { file_path: '/x/my-app/src/a.ts' } }));
  assert.strictEqual(s.snapshot().state, 'working');
  assert.strictEqual(s.snapshot().message, 'Bearbeite a.ts');
  assert.strictEqual(s.snapshot().task, 'Baue einen Login-Dialog');
  s.handleHookEvent(ev('Stop'));
  assert.strictEqual(s.snapshot().state, 'done');
});

test('needsInput wins over other sessions', () => {
  let t = 0;
  const s = new StateStore({ now: () => ++t, t: de });
  s.handleHookEvent(ev('Notification', { message: 'Claude needs your permission to use Bash' }));
  s.handleHookEvent(ev('PreToolUse', { session_id: 's2', tool_name: 'Read', tool_input: { file_path: '/a/b.md' } }));
  const snap = s.snapshot();
  assert.strictEqual(snap.state, 'needsInput');
  assert.strictEqual(snap.message, 'Darf ich Bash benutzen?');
  assert.strictEqual(snap.active, 2);
});

test('done stays until acknowledged', async () => {
  const s = new StateStore();
  s.handleHookEvent(ev('Stop'));
  await new Promise((r) => setTimeout(r, 30));
  assert.strictEqual(s.snapshot().state, 'done');
  assert.ok(s.acknowledge());
  assert.strictEqual(s.snapshot().state, 'idle');
  assert.strictEqual(s.acknowledge(), false);
});

test('optional ready timeout', async () => {
  const s = new StateStore({ readyMs: 20 });
  s.handleHookEvent(ev('Stop'));
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(s.snapshot().state, 'idle');
});

test('greeting fades on its own', async () => {
  const s = new StateStore({ greetMs: 20 });
  s.handleHookEvent(ev('SessionStart'));
  assert.strictEqual(s.snapshot().message, 'Ready!');
  await new Promise((r) => setTimeout(r, 50));
  assert.strictEqual(s.snapshot().message, '');
});

test('stale sessions are swept', () => {
  let now = 0;
  const s = new StateStore({ staleMs: 100, now: () => now });
  s.handleHookEvent(ev('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }));
  now = 500;
  assert.ok(s.sweep());
  assert.strictEqual(s.snapshot().state, 'idle');
});

test('SessionEnd removes the session', () => {
  const s = new StateStore();
  s.handleHookEvent(ev('UserPromptSubmit'));
  s.handleHookEvent(ev('SessionEnd'));
  assert.strictEqual(s.snapshot().state, 'idle');
  assert.strictEqual(s.sessions.size, 0);
});

test('generic /state API validates', () => {
  const s = new StateStore();
  assert.strictEqual(s.setState({ state: 'dancing' }), false);
  assert.ok(s.setState({ state: 'working', message: 'Rendering avatar', task: 'Make a video', project: 'agent' }));
  assert.strictEqual(s.snapshot().message, 'Rendering avatar');
  assert.strictEqual(s.snapshot().task, 'Make a video');
});

test('tool descriptions and languages', () => {
  assert.strictEqual(describeTool('Bash', { command: 'npm run build' }), '$ npm run build');
  assert.strictEqual(describeTool('Bash', { command: 'x', description: 'Builds it' }), 'Builds it');
  assert.strictEqual(describeTool('WebFetch', { url: 'https://example.com/a' }), 'Reading example.com');
  assert.strictEqual(describeTool('WebFetch', { url: 'https://example.com/a' }, de), 'Lese example.com');
  assert.strictEqual(describeTool('mcp__github__create_issue', {}), 'github: create_issue');
  assert.strictEqual(translateNotification('Claude is waiting for your input', de), 'Ich warte auf dich');
  assert.strictEqual(pickLanguage('auto', 'de-AT'), 'de');
  assert.strictEqual(pickLanguage('auto', 'fr-FR'), 'en');
  assert.strictEqual(pickLanguage('en', 'de-DE'), 'en');
});

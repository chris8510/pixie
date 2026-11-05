'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findClaude, isElectronApp } = require('../src/claude-bin');

const posix = process.platform !== 'win32';

function fakeBin(dir, name, output) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\necho "${output}"\n`, { mode: 0o755 });
  return file;
}

test('finds Claude Code in the desktop app folder when it is not on PATH', { skip: !posix }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  const appData = path.join(home, '.config', 'Claude'); // linux app-data location
  const real = fakeBin(path.join(appData, 'claude-code', '2.1.317'), 'claude', '2.1.317 (Claude Code)');
  const found = await findClaude({ platform: 'linux', env: { PATH: '/nonexistent' }, home, skipProcesses: true });
  assert.strictEqual(found, real);
});

test('never picks the desktop app itself or a wrong "claude"', { skip: !posix }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  // an Electron app folder with a binary called claude → must be skipped
  const electronDir = path.join(home, '.config', 'Claude', 'app-1');
  fakeBin(electronDir, 'claude', '2.1.317 (Claude Code)');
  fs.mkdirSync(path.join(electronDir, 'resources'));
  fs.writeFileSync(path.join(electronDir, 'resources', 'app.asar'), '');
  assert.ok(isElectronApp(path.join(electronDir, 'claude')));
  // a different program called claude on PATH → wrong --version output
  const other = path.join(home, 'bin');
  fakeBin(other, 'claude', 'claude-the-cat 1.0');
  assert.strictEqual(await findClaude({ platform: 'linux', env: { PATH: other }, home, skipProcesses: true }), null);
  // the real one on PATH wins
  const good = path.join(home, 'good');
  const real = fakeBin(good, 'claude', '2.1.400 (Claude Code)');
  assert.strictEqual(await findClaude({ platform: 'linux', env: { PATH: [other, good].join(path.delimiter) }, home, skipProcesses: true }), real);
});

test('a configured absolute path is used first', { skip: !posix }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  const mine = fakeBin(path.join(home, 'custom'), 'my-claude', '2.1.317 (Claude Code)');
  assert.strictEqual(await findClaude({ configured: mine, platform: 'linux', env: { PATH: '' }, home, skipProcesses: true }), mine);
});

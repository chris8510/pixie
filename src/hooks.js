'use strict';

// Adds/removes the Pixie hooks in Claude Code's settings (~/.claude/settings.json).
// The hook is a plain curl call, so it works without Node.js and is fast.
// Existing hooks are kept; a backup of the file is written before each change.

const fs = require('fs');
const os = require('os');
const path = require('path');

const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PreCompact', 'Notification', 'Stop', 'SessionEnd'];
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);
const MARKS = ['X-Pixie: 1', 'claude-pet-hook.js']; // second: entries from early versions

function settingsPath(env = process.env, home = os.homedir()) {
  return env.CLAUDE_SETTINGS || path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'settings.json');
}

function hookCommand(port) {
  // -m 1: never hold Claude Code up for more than a second; `|| true`: never report an error
  return `curl -s -m 1 -X POST -H "Content-Type: application/json" -H "X-Pixie: 1" --data-binary @- http://127.0.0.1:${port}/event || true`;
}

const isOurs = (h) => MARKS.some((m) => String(h && h.command || '').includes(m));

// Pure: returns a new settings object.
function applyHooks(settings, { port, remove = false }) {
  const out = { ...settings };
  const hooks = out.hooks && typeof out.hooks === 'object' ? { ...out.hooks } : {};
  for (const ev of EVENTS) {
    let list = Array.isArray(hooks[ev]) ? hooks[ev] : [];
    list = list
      .map((m) => ({ ...m, hooks: (m.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((m) => m.hooks.length > 0);
    if (!remove) {
      const entry = { hooks: [{ type: 'command', command: hookCommand(port), timeout: 5 }] };
      if (TOOL_EVENTS.has(ev)) entry.matcher = '*';
      list.push(entry);
    }
    if (list.length) hooks[ev] = list;
    else delete hooks[ev];
  }
  if (Object.keys(hooks).length) out.hooks = hooks;
  else delete out.hooks;
  return out;
}

function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`${file} is not valid JSON: ${err.message}`);
  }
}

function isInstalled(file = settingsPath()) {
  try {
    const s = readSettings(file);
    return EVENTS.every((ev) => (s.hooks?.[ev] || []).some((m) => (m.hooks || []).some(isOurs)));
  } catch {
    return false;
  }
}

function install({ port, remove = false, file = settingsPath() }) {
  const settings = readSettings(file);
  let backup = null;
  if (fs.existsSync(file)) {
    backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(file, backup);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(applyHooks(settings, { port, remove }), null, 2) + '\n');
  return { file, backup };
}

module.exports = { EVENTS, settingsPath, hookCommand, applyHooks, isInstalled, install };

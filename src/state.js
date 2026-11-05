'use strict';

// Pure state logic: turns Claude Code hook events into one pet state.
// No Electron in here, so it can be tested with plain Node.

const path = require('path');
const { translator } = require('./i18n');

const STATES = ['idle', 'thinking', 'working', 'needsInput', 'done', 'error'];
const PRIORITY = { needsInput: 5, error: 4, working: 3, thinking: 3, done: 2, idle: 0 };
const ACTIVE = new Set(['thinking', 'working', 'needsInput']);
const SETTLED = new Set(['done', 'error']); // stay until seen (Codex: "Ready" / "Blocked")

function truncate(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function describeTool(name, input, t = translator('en')) {
  const i = input && typeof input === 'object' ? input : {};
  const file = i.file_path || i.notebook_path || i.path;
  const f = file ? path.basename(String(file)) : '';
  switch (name) {
    case 'Bash':
      return i.description ? truncate(i.description, 40) : '$ ' + truncate(i.command, 38);
    case 'Read':
      return f ? t('read', { f }) : t('readAny');
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return f ? t('edit', { f }) : t('editAny');
    case 'Write':
      return f ? t('write', { f }) : t('writeAny');
    case 'Grep':
      return t('grep', { q: truncate(i.pattern, 26) });
    case 'Glob':
      return t('glob', { q: truncate(i.pattern, 24) });
    case 'WebSearch':
      return t('websearch', { q: truncate(i.query, 28) });
    case 'WebFetch':
      try { return t('webfetch', { host: new URL(i.url).hostname }); } catch { return t('webAny'); }
    case 'Task':
    case 'Agent':
      return i.description ? t('delegate', { d: truncate(i.description, 30) }) : t('delegateAny');
    case 'TodoWrite':
      return t('plan');
    default:
      if (typeof name === 'string' && name.startsWith('mcp__')) {
        const [, server, ...tool] = name.split('__');
        return truncate(`${server}: ${tool.join('__')}`, 40);
      }
      return name ? truncate(name, 40) : t('working');
  }
}

// The user's prompt as a short title. Apps may prepend context blocks such as
// <system-reminder>…</system-reminder>; those are not what the user typed.
function cleanPrompt(prompt) {
  let s = String(prompt || '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, ' ');
  // any other complete tag blocks at the very start, e.g. <context>…</context>
  for (let m; (m = s.match(/^\s*<([a-z][\w-]*)[^>]*>[\s\S]*?<\/\1>/i));) s = s.slice(m[0].length);
  return truncate(s, 80);
}

// Claude Code sends its notifications in English; translate the common ones.
function translateNotification(message, t = translator('en')) {
  const m = String(message || '');
  const perm = m.match(/needs your permission to use (.+)$/i);
  if (perm) return t('permission', { tool: truncate(perm[1], 40) });
  if (/waiting for your input/i.test(m)) return t('waiting');
  return m ? truncate(m, 90) : t('needInput');
}

class StateStore {
  // readyMs: how long "done"/"error" stay before going idle on their own (0 = until acknowledged)
  constructor({ greetMs = 6000, readyMs = 0, staleMs = 10 * 60 * 1000, now = Date.now, t = translator('en') } = {}) {
    Object.assign(this, { greetMs, readyMs, staleMs, now, t });
    this.sessions = new Map();
    this.timers = new Map();
    this.listeners = new Set();
    this.lastHookAt = 0; // when Claude Code last reported anything (for "check connection")
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  handleHookEvent(ev) {
    if (!ev || typeof ev !== 'object') return false;
    const { t } = this;
    const id = String(ev.session_id || 'default');
    const project = ev.cwd ? path.basename(String(ev.cwd)) : undefined;
    // Hooks run async, so a tool event fired just before "Stop" can arrive just after it.
    const prev = this.sessions.get(id);
    if (ev.hook_event_name) this.lastHookAt = this.now();
    const late = ['PreToolUse', 'PostToolUse', 'PreCompact'].includes(ev.hook_event_name);
    if (late && prev && prev.state === 'done' && this.now() - prev.ts < 2000) return false;
    switch (ev.hook_event_name) {
      case 'SessionStart':
        this.set(id, 'idle', t('ready'), project, '');
        this.scheduleIdle(id, this.greetMs);
        return true;
      case 'UserPromptSubmit':
        return this.set(id, 'thinking', t('thinking'), project, typeof ev.prompt === 'string' ? cleanPrompt(ev.prompt) : undefined);
      case 'PreToolUse':
        return this.set(id, 'working', describeTool(ev.tool_name, ev.tool_input, t), project);
      case 'PostToolUse':
        return this.set(id, 'thinking', t('thinking'), project);
      case 'PreCompact':
        return this.set(id, 'thinking', t('compacting'), project);
      case 'Notification':
        return this.set(id, 'needsInput', translateNotification(ev.message, t), project);
      case 'Stop':
        return this.set(id, 'done', t('done'), project);
      case 'SessionEnd':
        this.clearTimer(id);
        this.sessions.delete(id);
        this.emit();
        return true;
      default:
        return false; // SubagentStop etc.: main agent keeps going, nothing to show
    }
  }

  // Generic API for other agents: { state, message?, task?, session?, project? }
  setState(data) {
    if (!data || !STATES.includes(data.state)) return false;
    const id = String(data.session || 'custom');
    this.set(id, data.state, truncate(data.message || '', 90), data.project ? truncate(data.project, 30) : undefined,
      typeof data.task === 'string' ? truncate(data.task, 80) : undefined);
    return true;
  }

  // task: the user's prompt (shown as title); undefined keeps the previous one
  set(id, state, message, project, task) {
    this.clearTimer(id);
    const prev = this.sessions.get(id);
    this.sessions.set(id, { state, message, project: project ?? prev?.project, task: task ?? prev?.task ?? '', ts: this.now() });
    if (SETTLED.has(state) && this.readyMs > 0) this.scheduleIdle(id, this.readyMs);
    this.emit();
    return true;
  }

  // The user has seen the result: finished/blocked sessions go back to idle.
  acknowledge() {
    let changed = false;
    for (const [id, s] of this.sessions) {
      if (SETTLED.has(s.state)) {
        this.clearTimer(id);
        this.sessions.set(id, { ...s, state: 'idle', message: '' });
        changed = true;
      }
    }
    if (changed) this.emit();
    return changed;
  }

  scheduleIdle(id, ms) {
    this.clearTimer(id);
    const timer = setTimeout(() => {
      this.timers.delete(id);
      const s = this.sessions.get(id);
      if (s && !ACTIVE.has(s.state)) {
        this.sessions.set(id, { ...s, state: 'idle', message: '' });
        this.emit();
      }
    }, ms);
    if (timer.unref) timer.unref();
    this.timers.set(id, timer);
  }

  clearTimer(id) {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  // Sessions that went quiet (crash, closed terminal) fall back to idle.
  sweep() {
    let changed = false;
    const now = this.now();
    for (const [id, s] of this.sessions) {
      if (ACTIVE.has(s.state) && now - s.ts > this.staleMs) {
        this.sessions.set(id, { ...s, state: 'idle', message: '' });
        changed = true;
      }
    }
    if (changed) this.emit();
    return changed;
  }

  snapshot() {
    let best = null;
    let active = 0;
    for (const s of this.sessions.values()) {
      if (ACTIVE.has(s.state)) active++;
      if (!best || PRIORITY[s.state] > PRIORITY[best.state] ||
          (PRIORITY[s.state] === PRIORITY[best.state] && s.ts > best.ts)) {
        best = s;
      }
    }
    if (!best) return { state: 'idle', message: '', task: '', project: undefined, active: 0 };
    return { state: best.state, message: best.message, task: best.task, project: best.project, active };
  }
}

module.exports = { StateStore, describeTool, translateNotification, cleanPrompt, truncate, STATES };

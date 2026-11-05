'use strict';

// Finds the Claude Code executable. People who use Claude Code through the
// Claude desktop app usually don't have `claude` on their PATH, so we look:
//   1. at the configured command (if it's a path that exists)
//   2. on PATH and in the usual install folders
//   3. at a running Claude Code process
//   4. inside the Claude desktop app's data folders
// Every candidate is verified with `--version` (must say "Claude Code"), and
// Electron apps (the Claude desktop app itself) are skipped, so we never launch
// the wrong program.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const isWin = (platform) => platform === 'win32';
const exeNames = (platform) => (isWin(platform) ? ['claude.exe', 'claude.cmd'] : ['claude']);

function usualDirs({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const fromPath = String(env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  const extra = isWin(platform)
    ? [path.join(home, '.local', 'bin'), path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm'),
      path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'claude')]
    : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', path.join(home, '.local', 'bin'),
      path.join(home, '.claude', 'local'), path.join(home, '.npm-global', 'bin'), path.join(home, '.bun', 'bin')];
  return [...new Set([...fromPath, ...extra])];
}

// Folders where the desktop app keeps its own copy of Claude Code.
function appDataDirs({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  if (isWin(platform)) {
    const roaming = env.APPDATA || path.join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const dirs = [path.join(roaming, 'Claude'), path.join(local, 'Claude'), path.join(local, 'AnthropicClaude')];
    // Store/MSIX installs keep their data virtualized under Packages\Claude_<id>\LocalCache
    let pkgs = [];
    try { pkgs = fs.readdirSync(path.join(local, 'Packages')).filter((n) => /^(Claude|Anthropic)/i.test(n)); } catch { /* none */ }
    for (const pkg of pkgs) {
      const cache = path.join(local, 'Packages', pkg, 'LocalCache');
      dirs.push(path.join(cache, 'Roaming', 'Claude'), path.join(cache, 'Local', 'Claude'), path.join(cache, 'Local', 'AnthropicClaude'));
    }
    return dirs;
  }
  if (platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'Claude')];
  return [path.join(home, '.config', 'Claude')];
}

// The Claude desktop app is an Electron app: its folder has resources/app.asar.
function isElectronApp(file) {
  const dir = path.dirname(file);
  return [path.join(dir, 'resources', 'app.asar'), path.join(dir, '..', 'Resources', 'app.asar')].some((p) => fs.existsSync(p));
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

// Newest matching files below `root`, at most `depth` levels deep.
function findBelow(root, names, depth = 7) {
  const found = [];
  const walk = (dir, d) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && d < depth && !['node_modules', 'Cache', 'Code Cache', 'GPUCache', 'logs'].includes(e.name)) walk(p, d + 1);
      else if (e.isFile() && names.includes(e.name)) found.push(p);
    }
  };
  walk(root, 0);
  return found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function run(file, args, opts = {}) {
  return new Promise((resolve) => {
    const shell = /\.(cmd|bat)$/i.test(file);
    execFile(shell ? `"${file}"` : file, args, { timeout: 15000, windowsHide: true, shell, ...opts },
      (err, stdout) => resolve(err ? null : String(stdout)));
  });
}

async function verify(file) {
  if (!file || !isFile(file) || isElectronApp(file)) return false;
  const out = await run(file, ['--version']);
  return Boolean(out && /claude code/i.test(out));
}

// Paths of running Claude Code processes.
async function runningPaths(platform = process.platform) {
  if (isWin(platform)) {
    const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" -ErrorAction SilentlyContinue | ForEach-Object { $_.ExecutablePath }; "
      + 'Get-Process -Name claude -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }']);
    return out ? [...new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))] : [];
  }
  const out = await run('ps', ['-axo', 'comm=']);
  return out ? out.split('\n').map((s) => s.trim()).filter((s) => s.startsWith('/') && path.basename(s) === 'claude') : [];
}

async function findClaude({ configured, platform = process.platform, env = process.env, home = os.homedir(), skipProcesses = false, processesOnly = false } = {}) {
  const tried = new Set();
  const check = async (file) => {
    if (!file || tried.has(file)) return null;
    tried.add(file);
    return (await verify(file)) ? file : null;
  };
  const names = exeNames(platform);

  if (processesOnly) {
    for (const p of await runningPaths(platform)) {
      const hit = await check(p);
      if (hit) return hit;
    }
    return null;
  }

  if (configured && (path.isAbsolute(configured) || configured.startsWith('~'))) {
    const p = configured.startsWith('~') ? path.join(home, configured.slice(1)) : configured;
    const hit = await check(p);
    if (hit) return hit;
  }
  const wanted = configured && !path.isAbsolute(configured) ? [configured, ...names] : names;
  for (const dir of usualDirs({ platform, env, home })) {
    for (const n of wanted) {
      const hit = await check(path.join(dir, n));
      if (hit) return hit;
    }
  }
  if (!skipProcesses) {
    for (const p of await runningPaths(platform)) {
      const hit = await check(p);
      if (hit) return hit;
    }
  }
  for (const root of appDataDirs({ platform, env, home })) {
    for (const p of findBelow(root, names)) {
      const hit = await check(p);
      if (hit) return hit;
    }
  }
  return null;
}

module.exports = { findClaude, verify, isElectronApp, usualDirs, appDataDirs };

'use strict';

const {
  app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, session,
  globalShortcut, Notification, shell, clipboard, systemPreferences,
} = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { StateStore } = require('./src/state');
const { createServer } = require('./src/server');
const { petRoots, scanPets: scanPetFolders, sheetDataUrl } = require('./src/pets');
const { findClaude, verify: verifyClaude } = require('./src/claude-bin');
const hooks = require('./src/hooks');
const { PIXIE_HOME, USER_CONFIG, loadConfig, expandHome } = require('./src/config');
const { STRINGS, DEFAULT_PROMPTS, pickLanguage, translator } = require('./src/i18n');
const { Voice } = require('./src/voice');

const WIN_W = 380;
const WIN_H = 480;
// Ignoring mouse events while still receiving mousemove only works on macOS/Windows.
const CLICK_THROUGH = process.platform !== 'linux';
const USER_PET_DIR = path.join(PIXIE_HOME, 'pets');

app.setName('Pixie');

const config = loadConfig();
let t = translator('en');
let lang = 'en';
let store = null;
let voice = null;
let win = null;
let tray = null;
let dragTimer = null;
let lastNotified = null;
let pets = [];
let settings = {};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(start);
}

function start() {
  lang = pickLanguage(config.language, app.getLocale());
  t = translator(lang);
  store = new StateStore({ t, readyMs: (config.readyTimeoutSeconds || 0) * 1000 });
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  loadSettings();
  scanPets();
  // Hooks written by an older Pixie (shell syntax that breaks under PowerShell) are fixed right away.
  if (hooks.isOutdated(config.port)) {
    try { hooks.install({ port: config.port }); } catch (err) { console.error('Could not update hooks:', err.message); }
  }
  setupPermissions();
  createWindow();
  startServer();

  if (config.voice.enabled) {
    voice = new Voice({
      model: config.voice.model,
      language: config.voice.language,
      dtype: config.voice.dtype,
      cacheDir: path.join(PIXIE_HOME, 'models'),
      onProgress: (percent) => send('voice:progress', percent),
    });
  }

  if (config.shortcut) {
    try { globalShortcut.register(config.shortcut, toggleWindow); } catch { /* invalid accelerator */ }
  }
  setInterval(() => store.sweep(), 30_000).unref();

  store.onChange((snap) => {
    send('state', snap);
    const key = snap.state === 'needsInput' ? snap.message : null;
    if (key && key !== lastNotified && config.notifyOnInput && Notification.isSupported()) {
      new Notification({ title: snap.project ? `Pixie · ${snap.project}` : 'Pixie', body: snap.message }).show();
    }
    lastNotified = key;
  });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ---------- settings (UI choices, not config) ----------

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')) || {}; } catch { settings = {}; }
}

function saveSettings() {
  try { fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); } catch { /* ignore */ }
}

// ---------- pets ----------

function scanPets() {
  const res = scanPetFolders(petRoots({ appDir: __dirname }));
  pets = res.pets;
  return res;
}

function rescanPets() {
  const { pets: found, skipped } = scanPets();
  const list = skipped.map((s) => `${path.basename(s.dir)} (${s.reason})`).join(', ');
  send('card', {
    title: t('petsFound', { n: found.length }),
    sub: skipped.length ? t('petsSkipped', { list }) : t('petsAllGood'),
    cls: skipped.length ? 'needsInput' : 'done',
    ms: skipped.length ? 15000 : 6000,
  });
  selectPet(selectedPet()?.id);
}

function selectedPet() {
  const wanted = settings.pet || config.pet;
  return pets.find((p) => p.id === wanted) || pets.find((p) => p.id === 'pixelchen') || pets[0] || null;
}

function selectPet(id) {
  settings.pet = id;
  saveSettings();
  send('pet:changed');
  refreshTrayMenu();
}

// ---------- window ----------

const POS_FILE = () => path.join(app.getPath('userData'), 'window.json');

function defaultPosition() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - WIN_W - 8, y: wa.y + wa.height - WIN_H - 4 };
}

function savedPosition() {
  try {
    const p = JSON.parse(fs.readFileSync(POS_FILE(), 'utf8'));
    const onScreen = screen.getAllDisplays().some(({ workArea: a }) =>
      p.x + WIN_W > a.x + 40 && p.x < a.x + a.width - 40 && p.y + WIN_H > a.y + 40 && p.y < a.y + a.height - 40);
    return onScreen ? p : null;
  } catch {
    return null;
  }
}

function savePosition() {
  if (!win) return;
  const [x, y] = win.getPosition();
  try { fs.writeFileSync(POS_FILE(), JSON.stringify({ x, y })); } catch { /* ignore */ }
}

function createWindow() {
  const pos = savedPosition() || defaultPosition();
  win = new BrowserWindow({
    title: 'Pixie',
    width: WIN_W,
    height: WIN_H,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (CLICK_THROUGH) win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => { win = null; });
}

function showWindow() {
  if (!win) return createWindow();
  win.showInactive();
}

function toggleWindow() {
  if (!win) return createWindow();
  if (win.isVisible()) win.hide(); else win.showInactive();
}

function setupPermissions() {
  const allow = (wc, permission) => permission === 'media' && win && wc === win.webContents;
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allow(wc, permission)));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => allow(wc, permission));
}

// ---------- menu ----------

function petMenu() {
  const current = selectedPet();
  const items = [];
  let lastSource = null;
  for (const p of pets) {
    if (p.source !== lastSource) {
      if (items.length) items.push({ type: 'separator' });
      items.push({ label: t(`src_${p.source}`), enabled: false });
      lastSource = p.source;
    }
    items.push({ label: p.displayName, type: 'radio', checked: current?.id === p.id, click: () => selectPet(p.id) });
  }
  items.push({ type: 'separator' });
  items.push({ label: t('rescanPets'), click: rescanPets });
  items.push({
    label: t('openPetFolder'),
    click: () => { fs.mkdirSync(USER_PET_DIR, { recursive: true }); shell.openPath(USER_PET_DIR); },
  });
  return items;
}

function buildMenu() {
  const connected = hooks.isInstalled();
  const items = [
    { label: win && win.isVisible() ? t('hide') : t('show'), click: toggleWindow },
    { label: t('pet'), submenu: petMenu() },
    { type: 'separator' },
    connected
      ? { label: t('hooksRemove'), click: () => setHooks(true) }
      : { label: t('hooksInstall'), click: () => setHooks(false) },
    { label: t('checkConnection'), click: checkConnection },
    {
      label: t('alwaysOnTop'),
      type: 'checkbox',
      checked: win ? win.isAlwaysOnTop() : true,
      click: (item) => win && win.setAlwaysOnTop(item.checked, 'floating'),
    },
  ];
  if (process.platform !== 'linux') {
    items.push({
      label: t('openAtLogin'),
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    });
  }
  items.push(
    { label: t('resetPosition'), click: () => { if (win) { const p = defaultPosition(); win.setPosition(p.x, p.y); savePosition(); } } },
    { type: 'separator' },
    { label: t('openSettings'), click: () => shell.openPath(USER_CONFIG) },
    { label: t('reload'), click: () => { app.relaunch(); app.exit(0); } },
    { type: 'separator' },
    { label: t('quit'), click: () => app.quit() },
  );
  return Menu.buildFromTemplate(items);
}

function checkConnection() {
  let card;
  if (!hooks.isInstalled()) card = { title: t('checkNo'), sub: t('checkNoSub'), cls: 'error' };
  else if (!store.lastHookAt) card = { title: t('checkWaiting'), sub: t('checkWaitingSub'), cls: 'needsInput' };
  else {
    const s = Math.max(1, Math.round((Date.now() - store.lastHookAt) / 1000));
    const ago = s < 60 ? t('agoSec', { n: s }) : s < 3600 ? t('agoMin', { n: Math.round(s / 60) }) : t('agoHour', { n: Math.round(s / 3600) });
    card = { title: t('checkOk'), sub: t('checkOkSub', { ago }), cls: 'done' };
  }
  showWindow();
  send('card', { ...card, ms: 9000 });
}

function refreshTrayMenu() {
  if (tray && process.platform === 'linux') tray.setContextMenu(buildMenu());
}

function setHooks(remove) {
  try {
    hooks.install({ port: config.port, remove });
    refreshTrayMenu();
    return { ok: true, installed: !remove };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------- IPC ----------

ipcMain.handle('config:get', () => ({
  petScale: config.petScale,
  prompts: Array.isArray(config.prompts) ? config.prompts : DEFAULT_PROMPTS[lang],
  sleepAfterSeconds: config.sleepAfterSeconds,
  voice: { enabled: Boolean(config.voice.enabled), autoSend: Boolean(config.voice.autoSend), maxSeconds: config.voice.maxSeconds || 60 },
  hooksInstalled: hooks.isInstalled(),
  strings: { ...STRINGS.en, ...STRINGS[lang] }, // raw – placeholders are filled in the renderer
}));
ipcMain.handle('state:get', () => store.snapshot());
ipcMain.on('state:ack', () => store.acknowledge());
ipcMain.handle('hooks:install', () => setHooks(false));
ipcMain.handle('prompt:run', (_e, prompt) => runClaude(String(prompt || '').slice(0, 8000)));

ipcMain.handle('pet:get', (_e, id) => {
  const pet = (id && pets.find((p) => p.id === id)) || selectedPet();
  if (!pet) return { error: 'No pet found – is the pets/ folder complete?' };
  try {
    return { id: pet.id, displayName: pet.displayName, pixelated: pet.pixelated, source: pet.source, dataUrl: sheetDataUrl(pet) };
  } catch (err) {
    return { id: pet.id, displayName: pet.displayName, error: err.message };
  }
});

ipcMain.handle('voice:access', async () => {
  if (!voice) return false;
  if (process.platform !== 'darwin') return true;
  if (systemPreferences.getMediaAccessStatus('microphone') === 'granted') return true;
  return systemPreferences.askForMediaAccess('microphone');
});

ipcMain.handle('voice:transcribe', async (_e, audio) => {
  if (!voice) return { ok: false, error: t('voiceOff') };
  if (!(audio instanceof Float32Array) || audio.length < 16000 * 0.3) return { ok: true, text: '' };
  return voice.transcribe(audio.length > 16000 * 120 ? audio.slice(0, 16000 * 120) : audio);
});

ipcMain.on('mouse:ignore', (_e, ignore) => {
  if (CLICK_THROUGH && win && !dragTimer) win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

ipcMain.on('drag:start', () => {
  if (!win || dragTimer) return;
  const c = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  const off = { x: c.x - wx, y: c.y - wy };
  let last = null;
  dragTimer = setInterval(() => {
    if (!win) return;
    const p = screen.getCursorScreenPoint();
    // Only move when the mouse moved: on Windows with display scaling, setting the
    // same position again and again shifts the window by rounding errors (drift).
    if (last && p.x === last.x && p.y === last.y) return;
    last = p;
    // setBounds with a fixed size keeps the window from slowly growing/shifting.
    win.setBounds({ x: Math.round(p.x - off.x), y: Math.round(p.y - off.y), width: WIN_W, height: WIN_H });
  }, 16);
});

ipcMain.on('drag:end', () => {
  clearInterval(dragTimer);
  dragTimer = null;
  savePosition();
});

ipcMain.on('menu:open', () => { if (win) buildMenu().popup({ window: win }); });
ipcMain.on('clipboard:write', (_e, text) => clipboard.writeText(String(text || '')));

ipcMain.on('tray:icon', (_e, dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return;
  const img = nativeImage.createFromBuffer(Buffer.from(dataUrl.split(',')[1], 'base64'), { scaleFactor: 2 });
  const tip = `Pixie · ${selectedPet()?.displayName || ''}`;
  if (tray) {
    tray.setImage(img);
    tray.setToolTip(tip);
    return;
  }
  tray = new Tray(img);
  tray.setToolTip(tip);
  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  refreshTrayMenu();
});

// ---------- status server ----------

function startServer() {
  const server = createServer(store);
  server.on('error', (err) => {
    const msg = err.code === 'EADDRINUSE' ? t('portBusy', { port: config.port }) : err.message;
    console.error(msg);
    store.set('app', 'error', msg);
  });
  server.listen(config.port, '127.0.0.1');
}

// ---------- quick prompts via `claude -p` ----------

function commandEnv() {
  const env = { ...process.env };
  if (process.platform !== 'win32') {
    // GUI apps on macOS don't inherit the shell PATH; add the usual install spots.
    const extra = ['/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local/bin'),
      path.join(os.homedir(), '.claude/local'), path.join(os.homedir(), '.npm-global/bin')];
    env.PATH = [...new Set([...(env.PATH || '').split(':'), ...extra])].filter(Boolean).join(':');
  }
  return env;
}

// Where Claude Code lives; remembered once found (desktop-app users often don't have it on PATH).
async function claudeBinary() {
  if (settings.claudePath && await verifyClaude(settings.claudePath)) return settings.claudePath;
  const found = await findClaude({ configured: config.claudeCommand, env: commandEnv() });
  if (found) {
    settings.claudePath = found;
    saveSettings();
  }
  return found;
}

async function runClaude(prompt) {
  if (!prompt.trim()) return { ok: false, output: t('emptyPrompt') };
  store.set('quick', 'thinking', t('searchingClaude'), undefined, prompt.length > 80 ? prompt.slice(0, 79) + '…' : prompt);
  const bin = await claudeBinary();
  if (!bin) {
    store.set('quick', 'error', t('failed'));
    return { ok: false, output: t('claudeNotFound') };
  }
  return runClaudeWith(bin, prompt);
}

function runClaudeWith(bin, prompt) {
  return new Promise((resolve) => {
    const cwd = expandHome(config.promptCwd) || os.homedir();
    // .cmd shims (npm on Windows) need a shell; real executables are started directly.
    const useShell = /\.(cmd|bat)$/i.test(bin);
    const args = ['-p', ...config.claudeArgs].map((a) => (useShell ? `"${String(a).replace(/"/g, '\\"')}"` : String(a)));
    let out = '';
    let err = '';
    let done = false;

    store.set('quick', 'thinking', t('asking'), undefined, prompt.length > 80 ? prompt.slice(0, 79) + '…' : prompt);

    const finish = (ok, output) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      store.set('quick', ok ? 'done' : 'error', ok ? t('answered') : t('failed'));
      resolve({ ok, output });
    };

    let child;
    try {
      child = spawn(useShell ? `"${bin}"` : bin, args, { cwd, env: commandEnv(), shell: useShell, windowsHide: true });
    } catch (e) {
      return finish(false, e.message);
    }
    const timer = setTimeout(() => {
      child.kill();
      finish(false, t('timeout', { s: config.promptTimeoutSeconds }));
    }, config.promptTimeoutSeconds * 1000);

    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.on('error', () => {});
    child.on('error', (e) => {
      if (e.code === 'ENOENT') delete settings.claudePath; // moved/updated – search again next time
      finish(false, e.code === 'ENOENT' ? t('claudeNotFound') : e.message);
    });
    child.on('close', (code) => finish(code === 0, code === 0 ? out.trim() || t('noOutput') : (err.trim() || out.trim() || `Exit code ${code}`)));
    child.stdin.end(prompt);
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (voice) voice.dispose();
});
app.on('window-all-closed', () => app.quit());

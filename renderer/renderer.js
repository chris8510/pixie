'use strict';

(async function () {
  const S = window.PetSheet;
  const $ = (id) => document.getElementById(id);

  const canvas = $('pet');
  const ctx = canvas.getContext('2d');
  const bubble = $('bubble');
  const bubbleTitle = $('bubble-title').querySelector('span');
  const bubbleSub = $('bubble-sub');
  const badge = $('badge');
  const zz = $('zz');
  const dock = $('dock');
  const pill = $('pill');
  const panels = { ask: $('askbox'), reply: $('reply') };
  const buttons = { ask: $('btn-ask'), voice: $('btn-voice'), reply: $('btn-reply') };
  const replyText = $('reply-text');
  const askInput = $('ask-input');

  const cfg = await window.pet.getConfig();
  const T = (key, vars = {}) => String(cfg.strings[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const sleepMs = (cfg.sleepAfterSeconds || 120) * 1000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // static texts
  document.documentElement.lang = cfg.strings.label_idle === 'Bereit' ? 'de' : 'en';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = T(el.dataset.t); });
  document.querySelectorAll('[data-t-title]').forEach((el) => { el.title = T(el.dataset.tTitle); });
  document.querySelectorAll('[data-t-label]').forEach((el) => { el.setAttribute('aria-label', T(el.dataset.tLabel)); });
  document.querySelectorAll('[data-t-placeholder]').forEach((el) => { el.placeholder = T(el.dataset.tPlaceholder); });
  if (!cfg.voice.enabled) buttons.voice.classList.add('hidden');

  // Claude state -> looping animation (row of the Codex atlas)
  const STATE_ANIM = {
    idle: 'idle',          // 1 rest
    thinking: 'running',   // 8 work
    working: 'running',    // 8 work
    needsInput: 'waiting', // 7 wait for input
    done: 'review',        // 9 review a finished result
    error: 'failed',       // 6 failed / blocked
  };

  let sheet = null; // { img, cw, ch, rows, counts, bbox, pixelated }
  let current = { state: 'idle', message: '', task: '', active: 0 };
  let stateStart = performance.now();
  let lastActivity = performance.now();
  let lastMouse = 0;
  let lookAngle = null;
  let drag = null;
  let oneShot = null; // { name, times, hold, start }
  let queue = [];
  let busy = false;
  let local = null; // card owned by the UI (voice, onboarding) – wins over Claude's state
  let cardAction = null;

  // ---------- loading a pet ----------

  async function loadPet(id) {
    const res = await window.pet.getPet(id);
    if (res.error || !res.dataUrl) throw new Error(res.error || 'unknown error');
    const img = new Image();
    img.src = res.dataUrl;
    await img.decode();
    const lay = S.layout(img.naturalWidth, img.naturalHeight);
    const scan = document.createElement('canvas');
    scan.width = img.naturalWidth;
    scan.height = img.naturalHeight;
    const sctx = scan.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const rgba = sctx.getImageData(0, 0, scan.width, scan.height).data;
    const alpha = new Uint8Array(rgba.length / 4);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    const { counts, bbox } = S.analyze(alpha, scan.width, lay);
    if (!counts[0]) throw new Error('row 1 (idle) is empty');
    return { ...res, img, ...lay, counts, bbox };
  }

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(sheet.cw * cfg.petScale);
    const h = Math.round(sheet.ch * cfg.petScale);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function updateTrayIcon() {
    const icon = document.createElement('canvas');
    icon.width = icon.height = 32;
    const ictx = icon.getContext('2d');
    ictx.imageSmoothingEnabled = !sheet.pixelated;
    ictx.imageSmoothingQuality = 'high';
    const b = sheet.bbox || { x: 0, y: 0, w: sheet.cw, h: sheet.ch };
    const k = 32 / Math.max(b.w, b.h);
    ictx.drawImage(sheet.img, b.x, b.y, b.w, b.h, (32 - b.w * k) / 2, (32 - b.h * k) / 2, b.w * k, b.h * k);
    window.pet.setTrayIcon(icon.toDataURL('image/png'));
  }

  async function switchPet() {
    try {
      sheet = await loadPet();
    } catch (err) {
      showLocal(T('petLoadFailed'), err.message, 'error', 6000);
      if (!sheet) {
        try { sheet = await loadPet('pixelchen'); } catch { return; }
      }
    }
    sizeCanvas();
    updateTrayIcon();
    playOnce([{ name: 'waving', times: 2 }]);
  }

  // ---------- status card ----------

  function paintCard(title, sub, cls) {
    bubbleTitle.textContent = title;
    bubbleSub.textContent = sub || '';
    bubble.className = `bubble hit ${cls || ''}`;
  }

  // UI-owned card (voice, onboarding, errors); ms = auto-hide
  function showLocal(title, sub, cls, ms, action) {
    clearTimeout(showLocal.timer);
    local = { title, sub, cls };
    cardAction = action || null;
    paintCard(title, sub, cls);
    if (ms) showLocal.timer = setTimeout(clearLocal, ms);
  }

  function clearLocal() {
    clearTimeout(showLocal.timer);
    local = null;
    cardAction = null;
    renderCard();
  }

  function renderCard() {
    if (local) return paintCard(local.title, local.sub, local.cls);
    const snap = current;
    if (!snap.message && snap.state === 'idle') return bubble.classList.add('hidden');
    const label = T(`label_${snap.state}`);
    // Title: the task (your prompt) if known, else what's happening now.
    // Subtitle: the current step and the project.
    const tail = snap.project || label;
    if (snap.task) paintCard(snap.task, snap.message ? `${snap.message} · ${tail}` : tail, snap.state);
    else paintCard(snap.message || label, [label, snap.project].filter(Boolean).join(' · '), snap.state);
  }

  bubble.addEventListener('click', () => {
    if (cardAction) return cardAction();
    if (local) return clearLocal();
    window.pet.ack(); // seen it: "done"/"blocked" go back to rest
    bubble.classList.add('hidden');
  });

  // ---------- state ----------

  function playOnce(list) {
    queue = reduceMotion.matches ? [] : list.filter((a) => sheet && sheet.counts[S.ROW[a.name]] > 0);
    oneShot = null;
    nextOneShot(performance.now());
  }

  function nextOneShot(now) {
    oneShot = queue.shift() || null;
    if (oneShot) oneShot.start = now;
  }

  function applyState(snap) {
    const changed = snap.state !== current.state;
    current = snap;
    const now = performance.now();
    if (snap.state !== 'idle') lastActivity = now;

    if (changed) {
      stateStart = now;
      if (snap.state === 'needsInput') playOnce([{ name: 'waving', times: 1 }]); // grab attention
      else if (snap.state === 'error') playOnce([{ name: 'failed', times: 1, hold: true }]);
      else if (snap.state === 'idle' && snap.message) playOnce([{ name: 'waving', times: 2 }]); // greeting
      else playOnce([]);
    }

    renderCard();
    badge.textContent = T('active', { n: snap.active });
    badge.classList.toggle('hidden', !(snap.active > 1));
  }

  // ---------- animation ----------

  function pickCell(now) {
    const still = reduceMotion.matches;
    if (drag) {
      const name = drag.dir < 0 ? 'running-left' : 'running-right';
      return still ? { row: S.ROW[name], col: 0 } : S.loopCell(name, now - drag.start, sheet.counts);
    }

    while (oneShot) {
      const dur = S.duration(oneShot.name, sheet.counts) * oneShot.times;
      const el = now - oneShot.start;
      const row = S.ROW[oneShot.name];
      const n = sheet.counts[row];
      if (el < dur) return { row, col: Math.floor((el / dur) * n * oneShot.times) % n };
      if (oneShot.hold && !queue.length) return { row, col: n - 1 };
      nextOneShot(now);
    }

    const sleeping = current.state === 'idle' && now - Math.max(lastActivity, lastMouse) > sleepMs;
    zz.classList.toggle('hidden', !sleeping || still);

    if (current.state === 'idle' && !sleeping && lookAngle !== null && sheet.rows >= 11 &&
        now - lastMouse < 1500 && sheet.counts[S.ROW['look-a']] && sheet.counts[S.ROW['look-b']]) {
      return S.lookCell(lookAngle);
    }
    const name = STATE_ANIM[current.state] || 'idle';
    if (still) {
      // reduced motion: one still frame per state still tells you what's going on
      const row = sheet.counts[S.ROW[name]] ? S.ROW[name] : 0;
      return { row, col: 0 };
    }
    return S.loopCell(name, now - stateStart, sheet.counts, sleeping ? 0.4 : 1);
  }

  let lastDrawn = '';
  function frame(now) {
    if (sheet) {
      const { row, col } = pickCell(now);
      const key = `${sheet.id}:${row}:${col}:${canvas.width}`;
      if (key !== lastDrawn) {
        lastDrawn = key;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = !sheet.pixelated;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sheet.img, col * sheet.cw, row * sheet.ch, sheet.cw, sheet.ch, 0, 0, canvas.width, canvas.height);
      }
    }
    requestAnimationFrame(frame);
  }

  await switchPet();
  window.pet.onPetChanged(async () => { lastDrawn = ''; await switchPet(); });
  window.pet.onState(applyState);
  applyState(await window.pet.getState());
  requestAnimationFrame(frame);

  // first start: offer to connect Claude Code
  if (!cfg.hooksInstalled) {
    showLocal(T('connectTitle'), T('connectSub'), 'needsInput', 0, async () => {
      const res = await window.pet.installHooks();
      if (res.ok) showLocal(T('connected'), T('connectedSub'), 'done', 5000);
      else showLocal(T('connectFailed'), res.error, 'error', 10000);
    });
  }

  // ---------- dock: pill with three buttons on hover ----------

  let hideTimer = null;
  const anyPanelOpen = () => Object.values(panels).some((p) => !p.classList.contains('hidden'));

  function setDock(open) {
    clearTimeout(hideTimer);
    if (open) {
      pill.classList.remove('hidden');
      dock.classList.add('open');
    } else {
      hideTimer = setTimeout(() => {
        if (anyPanelOpen() || recorder.recording) return;
        pill.classList.add('hidden');
        dock.classList.remove('open');
      }, 900);
    }
  }

  function togglePanel(name, force) {
    const show = Boolean(name) && (typeof force === 'boolean' ? force : panels[name].classList.contains('hidden'));
    for (const [key, panel] of Object.entries(panels)) {
      const on = key === name && show;
      panel.classList.toggle('hidden', !on);
      buttons[key].classList.toggle('active', on);
    }
    if (show && name === 'ask') setTimeout(() => askInput.focus(), 0);
    setDock(show);
  }

  buttons.ask.addEventListener('click', () => togglePanel('ask'));
  buttons.reply.addEventListener('click', () => togglePanel('reply'));

  // ---------- voice input (local Whisper) ----------

  const recorder = new window.PetRecorder();
  let recordTimer = null;
  let transcribing = false;

  window.pet.onVoiceProgress((percent) => {
    if (transcribing && percent < 100) showLocal(T('modelLoading'), `${percent} %`, 'thinking');
    else if (transcribing) showLocal(T('transcribing'), '', 'thinking');
  });

  async function toggleVoice() {
    if (transcribing) return;
    if (recorder.recording) return finishVoice();
    if (!(await window.pet.voiceAccess())) return showLocal(T('micDenied'), T('micDeniedSub'), 'error', 6000);
    try {
      await recorder.start();
    } catch (err) {
      return showLocal(T('micDenied'), err.message, 'error', 6000);
    }
    buttons.voice.classList.add('recording');
    togglePanel(null, false);
    setDock(true);
    showLocal(T('listening'), T('listeningSub'), 'needsInput', 0, finishVoice);
    recordTimer = setTimeout(finishVoice, (cfg.voice.maxSeconds || 60) * 1000);
  }

  async function finishVoice() {
    clearTimeout(recordTimer);
    if (!recorder.recording) return;
    buttons.voice.classList.remove('recording');
    transcribing = true;
    showLocal(T('transcribing'), '', 'thinking');
    try {
      const samples = await recorder.stop();
      const res = await window.pet.transcribe(samples);
      if (!res.ok) return showLocal(T('voiceFailed'), res.error, 'error', 8000);
      if (!res.text) return showLocal(T('nothingHeard'), T('nothingHeardSub'), 'error', 4000);
      clearLocal();
      askInput.value = askInput.value ? `${askInput.value} ${res.text}` : res.text;
      if (cfg.voice.autoSend) ask(askInput.value.trim());
      else togglePanel('ask', true);
    } catch (err) {
      showLocal(T('voiceFailed'), err.message, 'error', 8000);
    } finally {
      transcribing = false;
    }
  }

  buttons.voice.addEventListener('click', toggleVoice);

  // ---------- click-through, hover, look direction ----------

  let overHit = false;
  document.addEventListener('mousemove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hit = Boolean(el && el.closest('.hit'));
    if (hit !== overHit) {
      overHit = hit;
      window.pet.setIgnoreMouse(!hit);
    }
    setDock(Boolean(el && el.closest('#pet-col')));
    lastMouse = performance.now();
    const r = canvas.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height * 0.55);
    lookAngle = Math.hypot(dx, dy) < r.width * 0.3 ? null : Math.atan2(dx, -dy);
  });
  document.addEventListener('mouseleave', () => {
    overHit = false;
    lookAngle = null;
    setDock(false);
    window.pet.setIgnoreMouse(true);
  });

  // ---------- pet: click = hop (and "seen it"), drag = move ----------

  let press = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    press = { x: e.screenX, y: e.screenY, lastX: e.screenX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!drag && Math.hypot(e.screenX - press.x, e.screenY - press.y) > 3) {
      drag = { start: performance.now(), dir: e.screenX >= press.x ? 1 : -1 };
      window.pet.dragStart();
    }
    if (drag && Math.abs(e.screenX - press.lastX) > 1) {
      drag.dir = Math.sign(e.screenX - press.lastX);
      press.lastX = e.screenX;
    }
  });
  const release = (e) => {
    if (!press) return;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (drag) {
      drag = null;
      window.pet.dragEnd();
    } else if (e.type === 'pointerup') {
      if (current.state === 'done' || current.state === 'error') window.pet.ack();
      else if (!oneShot) playOnce([{ name: 'jumping', times: 1 }]);
    }
    press = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.pet.openMenu();
  });

  // ---------- asking Claude ----------

  const buttonsBox = $('prompt-buttons');
  (cfg.prompts || []).forEach(({ label, prompt }) => {
    if (!label || !prompt) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => ask(prompt));
    buttonsBox.appendChild(b);
  });
  if (!buttonsBox.children.length) buttonsBox.dataset.empty = T('emptyQuick');

  $('ask').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = askInput.value.trim();
    if (text) ask(text);
  });

  async function ask(prompt) {
    if (busy) return;
    busy = true;
    document.querySelectorAll('#askbox button, #askbox input').forEach((el) => { el.disabled = true; });
    togglePanel(null, false);
    try {
      const { ok, output } = await window.pet.runPrompt(prompt);
      replyText.textContent = output;
      $('reply-title').textContent = ok ? T('answer') : T('error');
      buttons.reply.disabled = false;
      togglePanel('reply', true);
      if (ok) askInput.value = '';
    } finally {
      busy = false;
      document.querySelectorAll('#askbox button, #askbox input').forEach((el) => { el.disabled = false; });
    }
  }

  $('reply-copy').addEventListener('click', () => window.pet.copy(replyText.textContent));
  $('reply-close').addEventListener('click', () => { togglePanel('reply', false); window.pet.ack(); });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (recorder.recording) {
      clearTimeout(recordTimer);
      recorder.cancel();
      buttons.voice.classList.remove('recording');
      clearLocal();
    }
    togglePanel(null, false);
  });
})();

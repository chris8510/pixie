'use strict';

// Main-process side of voice input: owns the Whisper worker.

const path = require('path');
const { Worker } = require('worker_threads');

class Voice {
  constructor({ model, language, dtype, cacheDir, onProgress }) {
    this.opts = { model, language, dtype, cacheDir };
    this.onProgress = onProgress || (() => {});
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
  }

  ensureWorker() {
    if (this.worker) return this.worker;
    const w = new Worker(path.join(__dirname, 'voice-worker.js'), { workerData: this.opts });
    w.on('message', (msg) => {
      if (msg.type === 'progress') this.onProgress(msg.percent);
      if (msg.type === 'ready') this.onProgress(100);
      if (msg.type === 'result') {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (p) p(msg.error ? { ok: false, error: msg.error } : { ok: true, text: msg.text });
      }
    });
    const fail = (err) => {
      for (const p of this.pending.values()) p({ ok: false, error: err?.message || 'Voice worker stopped' });
      this.pending.clear();
      this.worker = null;
    };
    w.on('error', fail);
    w.on('exit', (code) => { if (code !== 0) fail(new Error(`Voice worker exited (${code})`)); else this.worker = null; });
    this.worker = w;
    return w;
  }

  // audio: Float32Array, mono, 16 kHz
  transcribe(audio) {
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, resolve);
      try {
        this.ensureWorker().postMessage({ type: 'transcribe', id, audio }, [audio.buffer]);
      } catch (err) {
        this.pending.delete(id);
        resolve({ ok: false, error: err.message });
      }
    });
  }

  dispose() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }
}

module.exports = { Voice };

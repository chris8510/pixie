'use strict';

// Runs Whisper (via Transformers.js + ONNX Runtime) off the main thread.
// The model is downloaded once from Hugging Face into ~/.pixie/models.

const { parentPort, workerData } = require('worker_threads');

let pipePromise = null;
const files = new Map(); // file -> { loaded, total }

function reportProgress(p) {
  if (p.status === 'progress' && p.file) {
    files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    if (total > 0) parentPort.postMessage({ type: 'progress', percent: Math.min(99, Math.round((loaded / total) * 100)) });
  }
}

function getPipeline() {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = workerData.cacheDir;
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', workerData.model, {
        dtype: workerData.dtype || 'q8',
        device: 'cpu',
        progress_callback: reportProgress,
      });
    })();
    pipePromise.catch(() => { pipePromise = null; });
  }
  return pipePromise;
}

parentPort.on('message', async (msg) => {
  if (msg.type !== 'transcribe') return;
  try {
    const transcribe = await getPipeline();
    parentPort.postMessage({ type: 'ready' });
    const opts = { task: 'transcribe', chunk_length_s: 30 };
    if (workerData.language && workerData.language !== 'auto') opts.language = workerData.language;
    const out = await transcribe(msg.audio, opts);
    parentPort.postMessage({ type: 'result', id: msg.id, text: String(out?.text || '').trim() });
  } catch (err) {
    parentPort.postMessage({ type: 'result', id: msg.id, error: err.message || String(err) });
  }
});

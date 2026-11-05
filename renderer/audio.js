'use strict';

// Microphone recording -> Float32Array, mono, 16 kHz (what Whisper expects).

(function (root) {
  class Recorder {
    async start() {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      this.chunks = [];
      this.rec = new MediaRecorder(this.stream);
      this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
      this.stopped = new Promise((resolve) => { this.rec.onstop = resolve; });
      this.rec.start();
    }

    get recording() {
      return Boolean(this.rec && this.rec.state === 'recording');
    }

    async stop() {
      if (!this.rec) return new Float32Array(0);
      if (this.rec.state !== 'inactive') this.rec.stop();
      await this.stopped;
      this.stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(this.chunks, { type: this.rec.mimeType });
      this.rec = null;
      return Recorder.toMono16k(await blob.arrayBuffer());
    }

    cancel() {
      if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
      if (this.stream) this.stream.getTracks().forEach((tr) => tr.stop());
      this.rec = null;
    }

    static async toMono16k(arrayBuffer) {
      if (!arrayBuffer.byteLength) return new Float32Array(0);
      const ctx = new AudioContext();
      try {
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        const frames = Math.max(1, Math.ceil(decoded.duration * 16000));
        const off = new OfflineAudioContext(1, frames, 16000);
        const src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start();
        const rendered = await off.startRendering();
        return rendered.getChannelData(0).slice();
      } finally {
        ctx.close();
      }
    }
  }

  root.PetRecorder = Recorder;
})(window);

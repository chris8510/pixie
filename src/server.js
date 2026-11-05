'use strict';

// Local status server. Claude Code hooks POST their event JSON to /event,
// other agents can POST { state, message, … } to /state.

const http = require('http');

const HEADER = 'x-pixie';
const MAX_BYTES = 8 * 1024 * 1024; // Write/Edit events carry file contents

function createServer(store) {
  return http.createServer((req, res) => {
    const reply = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(body ? JSON.stringify(body) : '');
    };
    if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true, app: 'pixie', ...store.snapshot() });
    if (req.method !== 'POST' || !['/event', '/state'].includes(req.url)) return reply(404, { error: 'not found' });
    // A custom header forces browsers into a CORS preflight, which we never
    // answer – so websites can't talk to the pet.
    if (req.headers[HEADER] !== '1') return reply(403, { error: 'missing X-Pixie header' });

    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) tooBig = true;
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return reply(413, { error: 'too large' });
      let data;
      // tolerate a UTF-8 BOM and trailing newline (e.g. Windows PowerShell 5.1 pipes add both)
      const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim();
      try { data = JSON.parse(text || '{}'); } catch { return reply(400, { error: 'invalid json' }); }
      if (req.url === '/event') {
        store.handleHookEvent(data);
        return reply(204);
      }
      return store.setState(data) ? reply(204) : reply(400, { error: 'unknown state' });
    });
  });
}

module.exports = { createServer, HEADER };

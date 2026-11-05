'use strict';

// Codex pet atlas: 8 columns, 9 rows (v1) or 11 rows (v2 with look directions),
// cells 192 × 208 at full size. Pure logic + canvas helpers, no DOM beyond that.

(function (root) {
  const COLS = 8;
  const CELL_RATIO = 208 / 192;

  const ANIMS = [
    { name: 'idle', frames: 6, fps: 6, pauseMs: 2200 },
    { name: 'running-right', frames: 8, fps: 10 },
    { name: 'running-left', frames: 8, fps: 10 },
    { name: 'waving', frames: 4, fps: 7 },
    { name: 'jumping', frames: 5, fps: 9 },
    { name: 'failed', frames: 8, fps: 7 },
    { name: 'waiting', frames: 6, fps: 6 },
    { name: 'running', frames: 6, fps: 8 },
    { name: 'review', frames: 6, fps: 6 },
    { name: 'look-a', frames: 8, fps: 0 },
    { name: 'look-b', frames: 8, fps: 0 },
  ];
  const ROW = Object.fromEntries(ANIMS.map((a, i) => [a.name, i]));

  function layout(width, height) {
    const cw = width / COLS;
    const rows = Math.round(height / (cw * CELL_RATIO));
    const ch = height / rows;
    if (!Number.isInteger(cw) || ![9, 11].includes(rows) || Math.abs(ch - cw * CELL_RATIO) > 2) {
      throw new Error(`Unerwartetes Format ${width}×${height} – erwartet 8 Spalten × 9 oder 11 Zeilen (z. B. 1536×1872 oder 1536×2288)`);
    }
    return { cw, ch, rows };
  }

  // Count frames per row by looking for non-transparent pixels; also find the
  // bounding box of the first idle frame (for the tray icon).
  function analyze(alpha, width, lay) {
    const { cw, ch, rows } = lay;
    const counts = [];
    let bbox = null;
    for (let r = 0; r < rows; r++) {
      let last = -1;
      for (let c = 0; c < COLS; c++) {
        const x0 = Math.round(c * cw);
        const y0 = Math.round(r * ch);
        let filled = false;
        for (let y = y0; y < y0 + ch && !filled; y += 3) {
          for (let x = x0; x < x0 + cw; x += 3) {
            if (alpha[y * width + x] > 16) { filled = true; break; }
          }
        }
        if (filled) last = c;
        if (r === 0 && c === 0 && filled) {
          let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
          for (let y = y0; y < y0 + ch; y++) {
            for (let x = x0; x < x0 + cw; x++) {
              if (alpha[y * width + x] > 16) {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
              }
            }
          }
          bbox = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
        }
      }
      counts.push(last + 1);
    }
    return { counts, bbox };
  }

  // Which cell to show for a looping animation after `elapsed` ms.
  function loopCell(name, elapsed, counts, speed = 1) {
    let anim = ANIMS[ROW[name]];
    if (!anim || !counts[ROW[name]]) anim = ANIMS[0];
    const row = ROW[anim.name];
    const n = counts[row] || 1;
    const fps = anim.fps * speed;
    const play = (n / fps) * 1000;
    const cycle = play + (anim.pauseMs || 0) / speed;
    const t = elapsed % cycle;
    return { row, col: t < play ? Math.floor((t * fps) / 1000) % n : 0 };
  }

  // Duration of one run through an animation (ms).
  function duration(name, counts) {
    const row = ROW[name];
    return ((counts[row] || 0) / ANIMS[row].fps) * 1000;
  }

  // 16 look directions, clockwise starting at "up"; angle in radians, clockwise from up.
  function lookCell(angle) {
    const k = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;
    return { row: k < 8 ? ROW['look-a'] : ROW['look-b'], col: k % 8 };
  }

  const api = { COLS, ANIMS, ROW, layout, analyze, loopCell, duration, lookCell };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PetSheet = api;
})(typeof window !== 'undefined' ? window : globalThis);

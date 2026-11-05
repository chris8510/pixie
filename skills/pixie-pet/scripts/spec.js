'use strict';

// The Codex pet atlas: 8 columns × 11 rows, 192 × 208 px per cell.

const COLS = 8;
const CELL_W = 192;
const CELL_H = 208;

const ROWS = [
  { anim: 'idle', frames: 6, label: 'Idle – breathe, blink' },
  { anim: 'running-right', frames: 8, label: 'Run right' },
  { anim: 'running-left', frames: 8, label: 'Run left' },
  { anim: 'waving', frames: 4, label: 'Wave' },
  { anim: 'jumping', frames: 5, label: 'Jump – start, rise, peak, fall, land' },
  { anim: 'failed', frames: 8, label: 'Failed / disappointed' },
  { anim: 'waiting', frames: 6, label: 'Waiting for input' },
  { anim: 'running', frames: 6, label: 'Working / thinking' },
  { anim: 'review', frames: 6, label: 'Reviewing a result' },
  { anim: 'look', frames: 8, label: 'Look: up → right → lower right (directions 0–7)', lookOffset: 0 },
  { anim: 'look', frames: 8, label: 'Look: down → left → upper left (directions 8–15)', lookOffset: 8 },
];

const WIDTH = COLS * CELL_W;          // 1536
const HEIGHT = ROWS.length * CELL_H;  // 2288 (v2); v1 sheets have 9 rows = 1872

module.exports = { COLS, CELL_W, CELL_H, ROWS, WIDTH, HEIGHT };

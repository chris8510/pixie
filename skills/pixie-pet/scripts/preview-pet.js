#!/usr/bin/env node
'use strict';

// Contact sheet for checking a pet by eye: every frame on a checkerboard,
// with the cell grid, the idle baseline (green) and a coloured stripe per row.
//
//   node preview-pet.js <pet-folder | spritesheet.png> [out.png] [--scale 0.5]
//   node preview-pet.js <pet-folder> --rows 6-8      close-up of rows 6–8 at full size
//
// Look at the output after every build – first the whole sheet (consistency,
// baseline, empty cells), then close-ups of the rows you changed (faces, props).
// Output goes next to the pet folder (<folder>-preview.png), never inside it.

const fs = require('fs');
const path = require('path');
const { COLS, CELL_W, CELL_H, ROWS } = require('./spec');
const { decodePNG, encodePNG } = require('./png');

const STRIPES = [[120, 120, 120], [66, 135, 245], [66, 135, 245], [245, 166, 35], [48, 184, 92], [229, 72, 77],
  [245, 200, 35], [61, 139, 253], [150, 90, 220], [140, 140, 140], [140, 140, 140]];

function preview(input, out, scale = 0.5, rowRange = null) {
  const sheetPath = fs.statSync(input).isDirectory()
    ? (() => {
      let rel = 'spritesheet.png';
      try { rel = JSON.parse(fs.readFileSync(path.join(input, 'pet.json'), 'utf8')).spritesheetPath || rel; } catch { /* default */ }
      return path.join(input, rel);
    })()
    : input;
  if (path.extname(sheetPath).toLowerCase() !== '.png') throw new Error('preview needs a PNG spritesheet');
  const img = decodePNG(fs.readFileSync(sheetPath));
  const rows = Math.round(img.height / CELL_H);
  const [firstRow, lastRow] = rowRange || [0, rows - 1];
  const STRIPE = 10;
  const W = Math.round((img.width + STRIPE) * scale);
  const H = Math.round((lastRow - firstRow + 1) * CELL_H * scale);
  const outBuf = Buffer.alloc(W * H * 4);

  // baseline from idle row
  let baseline = -1;
  for (let y = CELL_H - 1; y >= 0 && baseline < 0; y--) {
    for (let x = 0; x < CELL_W * COLS; x++) if (img.rgba[(y * img.width + x) * 4 + 3] > 16) { baseline = y; break; }
  }

  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const o = (Y * W + X) * 4;
      const sx = Math.floor(X / scale) - STRIPE;
      const sy = Math.min(img.height - 1, firstRow * CELL_H + Math.floor(Y / scale));
      const row = Math.floor(sy / CELL_H);
      let r, g, b;
      if (sx < 0) {
        [r, g, b] = STRIPES[row] || [100, 100, 100];
      } else {
        const checker = ((Math.floor(sx / 8) + Math.floor(sy / 8)) % 2) ? 236 : 248;
        r = g = b = checker;
        const cy = sy % CELL_H;
        const col = Math.floor(sx / CELL_W);
        if (col >= (ROWS[row]?.frames || 0)) { r = g = b = checker - 25; } // cells that must stay empty
        const i = (sy * img.width + sx) * 4;
        const a = img.rgba[i + 3] / 255;
        r = r * (1 - a) + img.rgba[i] * a; g = g * (1 - a) + img.rgba[i + 1] * a; b = b * (1 - a) + img.rgba[i + 2] * a;
        const gridX = sx % CELL_W < 1 / scale || sx % CELL_W >= CELL_W - 1;
        const gridY = cy < 1 / scale || cy >= CELL_H - 1;
        if (gridX || gridY) { r = 180; g = 180; b = 190; }
        if (baseline >= 0 && Math.abs(cy - baseline) < 1 / scale && a < 0.5) { r = 60; g = 200; b = 90; }
      }
      outBuf[o] = r; outBuf[o + 1] = g; outBuf[o + 2] = b; outBuf[o + 3] = 255;
    }
  }
  fs.writeFileSync(out, encodePNG(W, H, outBuf));
  return { out, rows };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const si = args.indexOf('--scale');
  let scale = si >= 0 ? Number(args.splice(si, 2)[1]) : 0.5;
  const ri = args.indexOf('--rows');
  let rowRange = null;
  if (ri >= 0) {
    const [a, b = a] = args.splice(ri, 2)[1].split('-').map((n) => Number(n) - 1);
    rowRange = [Math.max(0, a), Math.min(ROWS.length - 1, b)];
    if (si < 0) scale = 1;
  }
  const [input, outArg] = args;
  if (!input) {
    console.error('usage: node preview-pet.js <pet-folder | spritesheet.png> [out.png] [--scale 0.5]');
    process.exit(2);
  }
  const base = path.resolve(fs.statSync(input).isDirectory() ? input : path.dirname(input));
  const suffix = rowRange ? `-rows${rowRange[0] + 1}-${rowRange[1] + 1}` : '';
  const out = path.resolve(outArg || `${base}-preview${suffix}.png`);
  const { rows } = preview(path.resolve(input), out, scale, rowRange);
  console.log(`✓ ${out}`);
  ROWS.slice(0, rows).forEach((r, i) => {
    if (!rowRange || (i >= rowRange[0] && i <= rowRange[1])) console.log(`  row ${String(i + 1).padStart(2)}: ${r.label} (${r.frames})`);
  });
  console.log('  darker cells must stay empty · green line = idle baseline (feet)');
}

module.exports = { preview };

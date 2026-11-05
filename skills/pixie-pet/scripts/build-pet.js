#!/usr/bin/env node
'use strict';

// Renders a pet drawn in code into a Codex/Pixie pet folder.
//
//   node build-pet.js <pet-module.js> <output-folder>
//
// The pet module exports:
//   id, displayName, description   – for pet.json
//   width, height, scale           – logical canvas per cell (width*scale ≤ 192, height*scale ≤ 208)
//   pixelated (optional, true)     – keep pixels crisp when Pixie scales the pet
//   draw(ctx, anim, frame, frames) – draws one frame
//
// Drawing helpers: const { px, ellipse, … } = require('pixie-pet-kit');
//
// anim is one of: idle, running-right, running-left, waving, jumping, failed,
// waiting, running, review, look. For "look", frame is the direction 0–15
// (clockwise from up) and frames is 16. ctx has fillStyle/fillRect like a
// canvas, in logical pixels, origin top-left of the cell. The logical canvas
// is centred horizontally and sits on the bottom edge of the 192 × 208 cell.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { COLS, CELL_W, CELL_H, ROWS, WIDTH, HEIGHT } = require('./spec');
const { encodePNG } = require('./png');

// Pet modules can `require('pixie-pet-kit')` for the drawing helpers in pixel.js,
// no matter where the module file lives.
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === 'pixie-pet-kit') return path.join(__dirname, 'pixel.js');
  return resolve.call(this, request, ...rest);
};

function parseColor(c) {
  const s = String(c).trim();
  if (s.startsWith('rgb')) {
    const [r, g, b, a = 1] = s.match(/[\d.]+/g).map(Number);
    return [r, g, b, a];
  }
  let h = s.replace('#', '');
  if (h.length === 3) h = [...h].map((x) => x + x).join('');
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
}

function build(pet, outDir) {
  const scale = pet.scale || 1;
  const w = pet.width;
  const h = pet.height;
  if (!pet.id || !pet.displayName || typeof pet.draw !== 'function') throw new Error('pet module needs id, displayName and draw()');
  if (!(w > 0 && h > 0) || w * scale > CELL_W || h * scale > CELL_H) {
    throw new Error(`width*scale must be ≤ ${CELL_W} and height*scale ≤ ${CELL_H} (got ${w}×${h} at ${scale}×)`);
  }
  const offX = Math.floor((CELL_W - w * scale) / 2);
  const offY = CELL_H - h * scale;
  const sheet = Buffer.alloc(WIDTH * HEIGHT * 4);

  const cellContext = (col, row) => ({
    fillStyle: '#000000',
    fillRect(x, y, rw, rh) {
      const [r, g, b, a] = parseColor(this.fillStyle);
      if (a <= 0) return;
      const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
      const x1 = Math.min(w, Math.round(x + rw)), y1 = Math.min(h, Math.round(y + rh));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const X = col * CELL_W + offX + xx * scale + sx;
              const Y = row * CELL_H + offY + yy * scale + sy;
              const o = (Y * WIDTH + X) * 4;
              const da = sheet[o + 3] / 255;
              const oa = a + da * (1 - a);
              sheet[o] = Math.round((r * a + sheet[o] * da * (1 - a)) / oa);
              sheet[o + 1] = Math.round((g * a + sheet[o + 1] * da * (1 - a)) / oa);
              sheet[o + 2] = Math.round((b * a + sheet[o + 2] * da * (1 - a)) / oa);
              sheet[o + 3] = Math.round(oa * 255);
            }
          }
        }
      }
    },
  });

  ROWS.forEach((spec, row) => {
    for (let col = 0; col < Math.min(COLS, spec.frames); col++) {
      if (spec.anim === 'look') pet.draw(cellContext(col, row), 'look', spec.lookOffset + col, 16);
      else pet.draw(cellContext(col, row), spec.anim, col, spec.frames);
    }
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'spritesheet.png'), encodePNG(WIDTH, HEIGHT, sheet));
  const manifest = {
    id: pet.id,
    displayName: pet.displayName,
    description: pet.description || '',
    spritesheetPath: 'spritesheet.png',
  };
  if (pet.pixelated !== false) manifest.pixelated = true;
  fs.writeFileSync(path.join(outDir, 'pet.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { sheet, file: path.join(outDir, 'spritesheet.png') };
}

if (require.main === module) {
  const [modPath, outDir] = process.argv.slice(2);
  if (!modPath || !outDir) {
    console.error('usage: node build-pet.js <pet-module.js> <output-folder>');
    process.exit(2);
  }
  const pet = require(path.resolve(modPath));
  const { file } = build(pet, path.resolve(outDir));
  console.log(`✓ ${file} (${WIDTH}×${HEIGHT}) + pet.json`);
}

module.exports = { build };

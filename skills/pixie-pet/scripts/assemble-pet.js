#!/usr/bin/env node
'use strict';

// Builds a spritesheet from single frame images – for pets drawn in an art
// program or made with an image generator.
//
//   node assemble-pet.js <frames-folder> <output-folder> --id my-pet --name "My Pet" [--description "…"]
//   node assemble-pet.js --template <out.png>     (empty grid with guides to draw on)
//
// Frame files are PNGs (transparent background) named <animation>-<n>.png,
// n starting at 1:
//   idle-1…6, running-right-1…8, running-left-1…8, waving-1…4, jumping-1…5,
//   failed-1…8, waiting-1…6, running-1…6, review-1…6, look-1…16
// look-1 = looking up, then clockwise: look-5 = right, look-9 = down, look-13 = left.
// Frames up to 192 × 208 px; smaller ones are centred and placed on the bottom edge.
// Missing running-left frames are mirrored from running-right.

const fs = require('fs');
const path = require('path');
const { COLS, CELL_W, CELL_H, ROWS, WIDTH, HEIGHT } = require('./spec');
const { decodePNG, encodePNG } = require('./png');

function blit(sheet, img, col, row, flip = false) {
  if (img.width > CELL_W || img.height > CELL_H) throw new Error(`frame is ${img.width}×${img.height}, max ${CELL_W}×${CELL_H}`);
  const ox = col * CELL_W + Math.floor((CELL_W - img.width) / 2);
  const oy = row * CELL_H + (CELL_H - img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const sx = flip ? img.width - 1 - x : x;
      img.rgba.copy(sheet, ((oy + y) * WIDTH + ox + x) * 4, (y * img.width + sx) * 4, (y * img.width + sx) * 4 + 4);
    }
  }
}

function assemble(framesDir, outDir, { id, name, description = '' }) {
  const sheet = Buffer.alloc(WIDTH * HEIGHT * 4);
  const load = (file) => decodePNG(fs.readFileSync(path.join(framesDir, file)));
  const exists = (file) => fs.existsSync(path.join(framesDir, file));
  const missing = [];
  ROWS.forEach((spec, row) => {
    for (let col = 0; col < Math.min(COLS, spec.frames); col++) {
      const n = spec.anim === 'look' ? spec.lookOffset + col + 1 : col + 1;
      const file = `${spec.anim}-${n}.png`;
      if (exists(file)) blit(sheet, load(file), col, row);
      else if (spec.anim === 'running-left' && exists(`running-right-${n}.png`)) blit(sheet, load(`running-right-${n}.png`), col, row, true);
      else missing.push(file);
    }
  });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'spritesheet.png'), encodePNG(WIDTH, HEIGHT, sheet));
  fs.writeFileSync(path.join(outDir, 'pet.json'), JSON.stringify({
    id, displayName: name || id, description, spritesheetPath: 'spritesheet.png',
  }, null, 2) + '\n');
  return { missing };
}

// Empty atlas with cell borders, a suggested baseline and the cells to leave empty.
function template(out) {
  const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
  const set = (x, y, [r, g, b, a]) => { const o = (y * WIDTH + x) * 4; buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a; };
  const BASE = CELL_H - 14;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const row = Math.floor(y / CELL_H);
      const col = Math.floor(x / CELL_W);
      const cx = x % CELL_W;
      const cy = y % CELL_H;
      if (col >= ROWS[row].frames) set(x, y, [0, 0, 0, 40]);
      if (cx === 0 || cy === 0) set(x, y, [120, 120, 140, 160]);
      else if (cy === BASE && cx % 6 < 3) set(x, y, [40, 180, 90, 160]);
      else if (cx === CELL_W / 2 && cy % 6 < 3) set(x, y, [200, 120, 60, 90]);
    }
  }
  fs.writeFileSync(out, encodePNG(WIDTH, HEIGHT, buf));
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const tpl = opt('--template');
  if (tpl) {
    template(path.resolve(tpl));
    console.log(`✓ ${tpl} – grid lines: cells; green: suggested feet line; orange: centre; dark cells stay empty. Delete the guides before exporting.`);
    process.exit(0);
  }
  const id = opt('--id');
  const name = opt('--name');
  const description = opt('--description');
  const [framesDir, outDir] = args;
  if (!framesDir || !outDir || !id) {
    console.error('usage: node assemble-pet.js <frames-folder> <output-folder> --id my-pet --name "My Pet"\n       node assemble-pet.js --template grid.png');
    process.exit(2);
  }
  const { missing } = assemble(path.resolve(framesDir), path.resolve(outDir), { id, name, description });
  console.log(`✓ ${path.join(outDir, 'spritesheet.png')}`);
  if (missing.length) console.log(`⚠ ${missing.length} frame(s) missing: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`);
}

module.exports = { assemble, template };

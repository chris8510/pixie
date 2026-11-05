#!/usr/bin/env node
'use strict';

// App icon (build/icon.png, 1024 × 1024): the first idle frame of Pixelchen,
// enlarged on a rounded warm square. Run after rebuilding the sheet.

const fs = require('fs');
const path = require('path');
const { decodePNG, encodePNG } = require('../skills/pixie-pet/scripts/png');

const SHEET = path.join(__dirname, '..', 'pets', 'pixelchen', 'spritesheet.png');
const OUT = path.join(__dirname, '..', 'build', 'icon.png');
const SIZE = 1024;
const SOURCE_PX = 5;   // Pixelchen is drawn at 5× in the sheet
const ICON_PX = 20;    // one logical pixel in the icon

const sheet = decodePNG(fs.readFileSync(SHEET));
const icon = Buffer.alloc(SIZE * SIZE * 4);
const radius = 220;
const inset = 64;
for (let y = inset; y < SIZE - inset; y++) {
  for (let x = inset; x < SIZE - inset; x++) {
    const cx = Math.min(Math.max(x, inset + radius), SIZE - inset - radius);
    const cy = Math.min(Math.max(y, inset + radius), SIZE - inset - radius);
    if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
    const k = y / SIZE;
    const o = (y * SIZE + x) * 4;
    icon[o] = Math.round(255 - 8 * k); icon[o + 1] = Math.round(244 - 20 * k); icon[o + 2] = Math.round(228 - 34 * k); icon[o + 3] = 255;
  }
}

let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
for (let y = 0; y < 208; y++) {
  for (let x = 0; x < 192; x++) {
    if (sheet.rgba[(y * sheet.width + x) * 4 + 3] > 0) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
}
const k = ICON_PX / SOURCE_PX;
const w = (maxX - minX + 1) * k;
const h = (maxY - minY + 1) * k;
const ox = Math.round((SIZE - w) / 2);
const oy = Math.round((SIZE - h) / 2 + 30);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const so = ((minY + Math.floor(y / k)) * sheet.width + minX + Math.floor(x / k)) * 4;
    const a = sheet.rgba[so + 3] / 255;
    if (!a) continue;
    const o = ((oy + y) * SIZE + ox + x) * 4;
    for (let c = 0; c < 3; c++) icon[o + c] = Math.round(sheet.rgba[so + c] * a + icon[o + c] * (1 - a));
    icon[o + 3] = Math.max(icon[o + 3], Math.round(a * 255));
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodePNG(SIZE, SIZE, icon));
console.log(`✓ ${path.relative(process.cwd(), OUT)}`);

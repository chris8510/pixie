#!/usr/bin/env node
'use strict';

// Checks a pet folder against the Codex/Pixie pet format and common mistakes.
//
//   node validate-pet.js <pet-folder>
//
// Exit code 0 = usable (maybe with warnings), 1 = errors.

const fs = require('fs');
const path = require('path');
const { COLS, CELL_W, CELL_H, ROWS } = require('./spec');
const { decodePNG, webpSize } = require('./png');

function analyzeSheet({ width, height, rgba }) {
  const rows = Math.round(height / CELL_H);
  const alphaAt = (x, y) => rgba[(y * width + x) * 4 + 3];
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const x0 = c * CELL_W, y0 = r * CELL_H;
      let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, opaque = 0, full = 0, solidBottom = -1;
      for (let y = y0; y < y0 + CELL_H; y++) {
        for (let x = x0; x < x0 + CELL_W; x++) {
          const a = alphaAt(x, y);
          if (a > 16) {
            opaque++;
            if (a === 255) full++;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (a >= 160 && y > solidBottom) solidBottom = y; // ignores soft shadows
          }
        }
      }
      row.push(opaque ? {
        empty: false, opaque, full,
        left: minX - x0, right: maxX - x0, top: minY - y0, bottom: (solidBottom >= 0 ? solidBottom : maxY) - y0,
      } : { empty: true });
    }
    cells.push(row);
  }
  return { rows, cells };
}

function validate(dir) {
  const errors = [];
  const warnings = [];
  const info = [];

  let manifest = {};
  const manifestPath = path.join(dir, 'pet.json');
  if (!fs.existsSync(manifestPath)) warnings.push('pet.json missing – the folder name will be used as id/name');
  else {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { errors.push(`pet.json is not valid JSON: ${e.message}`); }
    if (!manifest.id) warnings.push('pet.json: "id" missing');
    if (!manifest.displayName) warnings.push('pet.json: "displayName" missing');
    if (manifest.id && !/^[a-z0-9][a-z0-9-_]*$/i.test(manifest.id)) warnings.push('pet.json: use only letters, digits, - and _ in "id"');
  }

  const sheetRel = manifest.spritesheetPath || ['spritesheet.webp', 'spritesheet.png'].find((f) => fs.existsSync(path.join(dir, f)));
  const sheetPath = sheetRel && path.join(dir, sheetRel);
  if (!sheetPath || !fs.existsSync(sheetPath)) {
    errors.push(`spritesheet not found (${sheetRel || 'spritesheet.webp / spritesheet.png'})`);
    return { errors, warnings, info };
  }
  const buf = fs.readFileSync(sheetPath);
  if (buf.length > 20 * 1024 * 1024) errors.push('spritesheet is larger than 20 MB');

  const ext = path.extname(sheetPath).toLowerCase();
  if (ext === '.webp') {
    const { width, height } = webpSize(buf);
    checkSize(width, height, errors, info);
    warnings.push('WebP can only be checked for size here. Validate the PNG before converting it to WebP.');
    return { errors, warnings, info };
  }
  if (ext !== '.png') {
    errors.push('spritesheet must be .png or .webp');
    return { errors, warnings, info };
  }

  let img;
  try { img = decodePNG(buf); } catch (e) { errors.push(`cannot read PNG: ${e.message}`); return { errors, warnings, info }; }
  if (!checkSize(img.width, img.height, errors, info)) return { errors, warnings, info };

  const { rows, cells } = analyzeSheet(img);

  // background must be transparent
  const corners = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
  if (corners.some(([x, y]) => img.rgba[(y * img.width + x) * 4 + 3] > 16)) {
    errors.push('background is not transparent (corner pixels are opaque) – export with alpha / remove the background, then validate again');
    return { errors, warnings, info };
  }

  // frame counts per row
  const counts = [];
  ROWS.slice(0, rows).forEach((spec, r) => {
    const filled = cells[r].map((c) => !c.empty);
    const last = filled.lastIndexOf(true);
    const n = last + 1;
    counts.push(n);
    if (n === 0) (r === 0 ? errors : warnings).push(`row ${r + 1} (${spec.label}) is empty${r === 0 ? '' : ' – Pixie falls back to idle'}`);
    else if (n < spec.frames) warnings.push(`row ${r + 1} (${spec.label}): ${n} of ${spec.frames} frames`);
    else if (n > spec.frames) errors.push(`row ${r + 1} (${spec.label}): ${n} frames, but the format has ${spec.frames} – extra cells must stay transparent`);
    const gaps = [];
    const edges = [];
    const solid = [];
    cells[r].forEach((cell, c) => {
      if (c < n && cell.empty) gaps.push(c + 1);
      if (cell.empty) return;
      if (cell.left === 0 || cell.top === 0 || cell.right === CELL_W - 1 || cell.bottom === CELL_H - 1) edges.push(c + 1);
      if (cell.full > CELL_W * CELL_H * 0.9) solid.push(c + 1);
    });
    const list = (a) => (a.length > 3 ? `${a.length} frames` : `frame${a.length > 1 ? 's' : ''} ${a.join(', ')}`);
    if (gaps.length) warnings.push(`row ${r + 1}: ${list(gaps)} empty – gap in the animation`);
    if (edges.length) warnings.push(`row ${r + 1}: ${list(edges)} touch the cell edge – may look cut off`);
    if (solid.length) errors.push(`row ${r + 1}: ${list(solid)} almost completely opaque – background not removed?`);
  });

  // steady feet: the lowest solid pixel should not wander in rows that stay on
  // the ground (soft shadows are ignored, so they can't hide jitter)
  const grounded = { 0: 'idle', 5: 'failed', 7: 'working', 8: 'review', 9: 'look', 10: 'look' };
  const idleBottoms = cells[0].filter((c) => !c.empty).map((c) => c.bottom);
  const baseline = idleBottoms.length ? Math.max(...idleBottoms) : null;
  if (baseline !== null) {
    for (const [r, name] of Object.entries(grounded)) {
      if (r >= rows) continue;
      const bottoms = cells[r].filter((c) => !c.empty).map((c) => c.bottom);
      if (!bottoms.length) continue;
      const off = Math.max(...bottoms.map((b) => Math.abs(b - baseline)));
      if (off > 6) warnings.push(`row ${+r + 1} (${name}): feet move up to ${off}px away from the idle baseline – the pet will jitter`);
    }
    // jump: start and landing on the ground (smooth hand-over to idle), peak clearly above it
    const jump = cells[4] || [];
    if (!jump[0]?.empty && !jump[4]?.empty && jump.length >= 5) {
      for (const [i, name] of [[0, 'start'], [4, 'landing']]) {
        const off = Math.abs(jump[i].bottom - baseline);
        if (off > 6) warnings.push(`row 5 (jump): ${name} frame is ${off}px off the idle baseline – it should stand on the ground`);
      }
      const peak = Math.min(...jump.slice(1, 4).filter((c) => !c.empty).map((c) => c.bottom));
      if (baseline - peak < 10) warnings.push('row 5 (jump): the pet barely leaves the ground – lift it (feet included) in rise/peak/fall');
    }
    const idle = cells[0].find((c) => !c.empty);
    const centre = (idle.left + idle.right) / 2;
    const height = idle.bottom - idle.top + 1;
    if (Math.abs(centre - CELL_W / 2) > 20) warnings.push(`idle pose is ${Math.round(centre - CELL_W / 2)}px off centre`);
    if (height < 70) warnings.push(`the pet is only ${height}px tall – it will look tiny (aim for ~100–170px)`);
    if (idle.top < 12) warnings.push('little headroom above the idle pose – jump and wave may get cut off');
    info.push(`idle size ≈ ${idle.right - idle.left + 1}×${height}px, baseline y=${baseline}`);
  }
  info.push(`frames per row: ${counts.join('/')} (expected ${ROWS.slice(0, rows).map((r) => r.frames).join('/')})`);
  return { errors, warnings, info, counts };
}

function checkSize(width, height, errors, info) {
  info.push(`size ${width}×${height}`);
  if (width === 1536 && (height === 2288 || height === 1872)) {
    if (height === 1872) info.push('9-row sheet (no look directions) – works, the pet just won\'t follow the mouse');
    return true;
  }
  errors.push(`size must be 1536×2288 (11 rows) or 1536×1872 (9 rows), got ${width}×${height}`);
  return false;
}

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node validate-pet.js <pet-folder>');
    process.exit(2);
  }
  const { errors, warnings, info } = validate(path.resolve(dir));
  info.forEach((m) => console.log(`  ${m}`));
  warnings.forEach((m) => console.log(`⚠ ${m}`));
  errors.forEach((m) => console.log(`✗ ${m}`));
  console.log(errors.length ? `\n✗ ${errors.length} error(s)` : `\n✓ valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
  process.exit(errors.length ? 1 : 0);
}

module.exports = { validate, analyzeSheet };

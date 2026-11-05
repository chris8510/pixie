'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const KIT = path.join(__dirname, '..', 'skills', 'pixie-pet', 'scripts');
const { build } = require(path.join(KIT, 'build-pet.js'));
const { validate } = require(path.join(KIT, 'validate-pet.js'));
const { preview } = require(path.join(KIT, 'preview-pet.js'));
const { assemble, template } = require(path.join(KIT, 'assemble-pet.js'));
const { encodePNG, decodePNG } = require(path.join(KIT, 'png.js'));

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pixie-skill-'));

test('PNG encode/decode round trip', () => {
  const rgba = Buffer.from(Array.from({ length: 4 * 4 * 4 }, (_, i) => (i * 37) % 256));
  const back = decodePNG(encodePNG(4, 4, rgba));
  assert.strictEqual(back.width, 4);
  assert.deepStrictEqual(back.rgba, rgba);
});

test('the template pet builds, validates cleanly and previews', () => {
  const dir = path.join(tmp(), 'my-pet');
  build(require('../skills/pixie-pet/templates/pet-template.js'), dir);
  const res = validate(dir);
  assert.deepStrictEqual(res.errors, []);
  assert.deepStrictEqual(res.warnings, []);
  assert.deepStrictEqual(res.counts, [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]);
  const out = path.join(dir, 'preview.png');
  preview(dir, out);
  assert.ok(fs.statSync(out).size > 1000);
});

test('the shipped Pixelchen sheet is valid and up to date', () => {
  const dir = path.join(tmp(), 'pixelchen');
  build(require('../tools/pixelchen.js'), dir);
  const fresh = fs.readFileSync(path.join(dir, 'spritesheet.png'));
  const shipped = fs.readFileSync(path.join(__dirname, '..', 'pets', 'pixelchen', 'spritesheet.png'));
  assert.ok(fresh.equals(shipped), 'run npm run build-pixelchen');
  assert.deepStrictEqual(validate(path.join(__dirname, '..', 'pets', 'pixelchen')).errors, []);
});

test('validator catches opaque backgrounds, wrong sizes and extra frames', () => {
  const W = 1536, H = 2288;
  const write = (rgba, w = W, h = H) => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'spritesheet.png'), encodePNG(w, h, rgba));
    fs.writeFileSync(path.join(dir, 'pet.json'), '{"id":"x","displayName":"X","spritesheetPath":"spritesheet.png"}');
    return dir;
  };
  assert.match(validate(write(Buffer.alloc(W * H * 4, 255))).errors.join(), /not transparent/);
  assert.match(validate(write(Buffer.alloc(100 * 100 * 4), 100, 100)).errors.join(), /size must be/);
  const sheet = Buffer.alloc(W * H * 4);
  for (let c = 0; c < 8; c++) { const o = ((100 * W) + c * 192 + 96) * 4; sheet[o + 3] = 255; } // a dot in all 8 idle cells
  assert.match(validate(write(sheet)).errors.join(), /row 1 .*8 frames, but the format has 6/);
});

test('assemble builds a sheet from frames and mirrors running-left', () => {
  const frames = tmp();
  const dot = (w, h) => { const b = Buffer.alloc(w * h * 4); for (let i = 0; i < w; i++) b[((h - 1) * w + i) * 4 + 3] = 255; b[3] = 255; return encodePNG(w, h, b); };
  fs.writeFileSync(path.join(frames, 'idle-1.png'), dot(50, 60));
  fs.writeFileSync(path.join(frames, 'running-right-1.png'), dot(50, 60));
  const out = path.join(tmp(), 'pet');
  const { missing } = assemble(frames, out, { id: 'dot', name: 'Dot' });
  assert.ok(!missing.includes('running-left-1.png'));
  assert.ok(missing.includes('idle-2.png'));
  const img = decodePNG(fs.readFileSync(path.join(out, 'spritesheet.png')));
  const alpha = (x, y) => img.rgba[(y * img.width + x) * 4 + 3];
  assert.strictEqual(alpha(71, 148), 255);            // idle-1 top-left pixel, centred + bottom-aligned
  assert.strictEqual(alpha(120, 208 * 2 + 148), 255); // running-left-1 mirrored: top-left moved to top-right
  const tpl = path.join(tmp(), 'grid.png');
  template(tpl);
  assert.strictEqual(decodePNG(fs.readFileSync(tpl)).height, 2288);
});

test('the Pricklet example builds and matches the shipped pet', () => {
  const dir = path.join(tmp(), 'pricklet');
  build(require('../skills/pixie-pet/examples/pricklet.js'), dir);
  const shipped = fs.readFileSync(path.join(__dirname, '..', 'pets', 'pricklet', 'spritesheet.png'));
  assert.ok(fs.readFileSync(path.join(dir, 'spritesheet.png')).equals(shipped), 'run npm run build-pets');
  const res = validate(path.join(__dirname, '..', 'pets', 'pricklet'));
  assert.deepStrictEqual([res.errors, res.warnings], [[], []]);
});

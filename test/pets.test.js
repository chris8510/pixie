'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { petRoots, discoverPets } = require('../src/pets');
const S = require('../renderer/sheet');

test('discovers builtin, own and Codex pets', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-'));
  const codex = path.join(home, '.codex', 'pets');
  fs.mkdirSync(path.join(codex, 'owl'), { recursive: true });
  fs.writeFileSync(path.join(codex, 'owl', 'pet.json'), JSON.stringify({ id: 'owl', displayName: 'Eule', spritesheetPath: 'spritesheet.webp' }));
  fs.writeFileSync(path.join(codex, 'owl', 'spritesheet.webp'), 'x');
  fs.mkdirSync(path.join(codex, 'evil'));
  fs.writeFileSync(path.join(codex, 'evil', 'pet.json'), JSON.stringify({ spritesheetPath: '../../secret.png' }));
  fs.mkdirSync(path.join(home, '.pixie', 'pets', 'bare'), { recursive: true });
  fs.writeFileSync(path.join(home, '.pixie', 'pets', 'bare', 'spritesheet.png'), 'x');

  const pets = discoverPets(petRoots({ appDir: path.join(__dirname, '..'), home, env: {} }));
  const ids = pets.map((p) => `${p.source}:${p.id}`);
  assert.deepStrictEqual(ids, ['builtin:pixelchen', 'builtin:pricklet', 'user:bare', 'codex:owl']);
  assert.strictEqual(pets[3].displayName, 'Eule');
  assert.strictEqual(pets[0].pixelated, true);
});

test('sheet layout accepts v1 and v2 atlases', () => {
  assert.deepStrictEqual(S.layout(1536, 2288), { cw: 192, ch: 208, rows: 11 });
  assert.deepStrictEqual(S.layout(1536, 1872), { cw: 192, ch: 208, rows: 9 });
  assert.deepStrictEqual(S.layout(768, 1144), { cw: 96, ch: 104, rows: 11 });
  assert.throws(() => S.layout(1024, 1024));
});

test('look directions go clockwise from up', () => {
  const deg = (d) => (d * Math.PI) / 180;
  assert.deepStrictEqual(S.lookCell(0), { row: 9, col: 0 });          // up
  assert.deepStrictEqual(S.lookCell(deg(90)), { row: 9, col: 4 });    // right
  assert.deepStrictEqual(S.lookCell(deg(180)), { row: 10, col: 0 });  // down
  assert.deepStrictEqual(S.lookCell(deg(-90)), { row: 10, col: 4 });  // left
  assert.deepStrictEqual(S.lookCell(deg(-22)), { row: 10, col: 7 });  // upper left
});

test('idle pauses on the first frame between cycles', () => {
  const counts = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8];
  assert.deepStrictEqual(S.loopCell('idle', 500, counts), { row: 0, col: 3 });
  assert.deepStrictEqual(S.loopCell('idle', 2000, counts), { row: 0, col: 0 });
  assert.deepStrictEqual(S.loopCell('running', 130, counts), { row: 7, col: 1 });
  // missing row falls back to idle
  assert.strictEqual(S.loopCell('failed', 0, [6, 8, 8, 4, 5, 0, 6, 6, 6]).row, 0);
});

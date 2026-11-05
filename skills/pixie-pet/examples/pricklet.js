'use strict';

// Pricklet – a sleepy little cactus in a clay pot.
// Logical canvas 48 × 52 at 4× = 192 × 208 (full cell). Keep a margin to the edges.

const { px, stroke, sprite, lookVector, wave } = require('pixie-pet-kit');

const W = 48;
const H = 52;
const CX = 24;
const GROUND = 49;            // shadow row; pot feet stand on GROUND-1
const PB = GROUND - 3;        // last row of the pot body
const PT = PB - 11;           // first row of the pot rim

const C = {
  outline: '#2a2233',
  green: '#6cbf5b',
  greenLight: '#a3dc7f',
  greenShade: '#3f8f4a',
  spine: '#f6f0cf',
  pot: '#c96a3d',
  potLight: '#e8935f',
  potShade: '#93472a',
  soil: '#5b3b2b',
  petal: '#f48fb5',
  petalShade: '#d4608e',
  sun: '#ffd25e',
  eye: '#1d1826',
  glint: '#ffffff',
  cheek: '#f7a1b8',
  drop: '#8fd3ff',
  glass: 'rgba(190,235,255,0.45)',
  handle: '#7a4a2a',
  brass: '#e0b04a',
  shadow: 'rgba(0,0,0,0.2)',
};

// Fill an arbitrary shape (inside(x,y) → bool) with a 1-px outline and a colour function.
function shape(ctx, x0, y0, x1, y1, inside, colorAt) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      px(ctx, x, y, edge ? C.outline : colorAt(x, y));
    }
  }
}

// Limb with outline: list of points, drawn as thick strokes.
function limb(ctx, pts, r = 1.5, G = { green: C.green }) {
  for (let i = 0; i < pts.length - 1; i++) stroke(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r + 1, C.outline);
  for (let i = 0; i < pts.length - 1; i++) stroke(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, G.green);
}

const Z = ['oooo', '..o.', '.o..', 'oooo'];
const DROP = ['.o..', '.oo.', 'occo', 'ocwo', '.oo.'];
const BANG = ['ooo', 'oyo', 'oyo', 'oyo', 'ooo', '...', 'ooo', 'oyo', 'ooo'];
const PUFF = ['.oo.', 'owwo', '.oo.'];

// p = { bob, feet, grow, fat, bend, eyes, mouth, look, armR, armL, droop, cheeks, extras }
function drawPet(ctx, p = {}) {
  const bob = p.bob || 0;
  const look = p.look || { x: 0, y: 0 };
  const feet = p.feet || [0, 0];
  const pt = PT + bob;
  const pb = PB + bob;
  // wilting fades the green
  const G = p.pale
    ? { green: '#9cbf5e', light: '#c9dc8a', shade: '#6f8f45' }
    : { green: C.green, light: C.greenLight, shade: C.greenShade };

  // shadow (shrinks in the air)
  const air = Math.min(4, Math.max(0, -bob));
  px(ctx, CX - 9 + air, GROUND, C.shadow, 18 - air * 2, 1);

  // cactus geometry
  const hw = 7.5 + (p.fat || 0);                 // half width
  const B = pt + 2;                              // hidden bottom
  const T = pt - 21 - (p.grow || 0);             // top of dome
  const bend = p.bend || 0;
  const off = (y) => bend * Math.max(0, Math.min(1, (B - y) / (B - T))) ** 2;
  const ccx = CX + (p.dx || 0);
  const inBody = (x, y) => {
    if (y < T || y > B) return false;
    const u = x + 0.5 - off(y) - ccx;
    const domeY = T + hw;
    if (y + 0.5 >= domeY) return Math.abs(u) <= hw;
    const v = y + 0.5 - domeY;
    return u * u + v * v <= hw * hw;
  };

  // arms (behind the body)
  const shY = T + 13;                            // right shoulder height
  const sx = (y) => ccx + off(y);
  const armR = p.armR || { up: 90, out: 5, len: 6 };
  if (armR !== 'none') {
    const s = [sx(shY) + hw - 2, shY];
    const e = [s[0] + armR.out, shY + (armR.elbowDy || 0)];
    const a = (armR.up * Math.PI) / 180;
    const h = armR.hand
      ? [s[0] + armR.hand[0], shY + armR.hand[1]]
      : [e[0] + Math.cos(a) * armR.len, e[1] - Math.sin(a) * armR.len];
    limb(ctx, [s, e, h], 1.5, G);
    p._hand = h;
  }
  const armL = p.armL === undefined ? 90 : p.armL;
  {
    const y = shY + 4;
    const s = [sx(y) - hw + 2, y];
    const e = [s[0] - 3.5, y];
    const a = (armL * Math.PI) / 180;
    limb(ctx, [s, e, [e[0] - Math.cos(a) * 3.5, e[1] - Math.sin(a) * 3.5]], 1.5, G);
  }

  // body
  shape(ctx, ccx - hw - Math.abs(bend) - 2, T - 1, ccx + hw + Math.abs(bend) + 2, B, inBody, (x, y) => {
    const u = (x + 0.5 - off(y) - ccx) / hw;
    if (u > 0.55) return G.shade;
    if (u < -0.35 && u > -0.75 && y > T + 2) return G.light;
    return G.green;
  });
  // ribs (short vertical shade lines low on the body, away from the face)
  for (let y = T + 15; y < pt; y++) {
    px(ctx, Math.round(sx(y) - 3), y, G.shade);
    px(ctx, Math.round(sx(y) + 2), y, G.shade);
  }
  // spines sticking out of the outline
  for (const [side, yy] of [[-1, T + 6], [1, T + 8], [-1, T + 16], [1, T + 18], [-1, T + 11], [1, T + 3]]) {
    const y = Math.round(yy);
    if (y >= pt) continue;
    const xEdge = side < 0 ? Math.floor(sx(y) - hw) - 1 : Math.ceil(sx(y) + hw);
    px(ctx, xEdge, y, C.spine);
  }

  // flower on top (droops sideways when wilting)
  const droop = p.droop || 0;
  const fx = Math.round(sx(T) - 4 + droop);
  const fy = Math.round(T - 5 + Math.abs(droop) * 0.6);
  const FLOWER = droop >= 3
    ? ['..ooo....', '.oppoo...', 'oppppoo..', 'oyyppqo..', '.oyyqqo..', '..ooooo..']
    : ['.oo...oo.', 'oppo.oppo', 'oppqoqppo', '.opyyypo.', 'opqyyyqpo', '.ooooooo.'];
  sprite(ctx, fx, fy, FLOWER, { o: C.outline, p: C.petal, q: C.petalShade, y: C.sun });

  // face
  const fyc = T + 9;
  const fxc = Math.round(sx(fyc) + look.x * 1.5);
  const ey = Math.round(fyc + look.y * 1.5);
  const eyesX = [fxc - 4, fxc + 2];
  for (const ex of eyesX) {
    const lx = Math.round(look.x * 0.6), ly = Math.round(look.y * 0.6);
    switch (p.eyes) {
      case 'closed': px(ctx, ex - 1, ey + 1, C.eye); px(ctx, ex, ey + 2, C.eye, 2, 1); px(ctx, ex + 2, ey + 1, C.eye); break;
      case 'happy': px(ctx, ex - 1, ey + 2, C.eye); px(ctx, ex, ey + 1, C.eye, 2, 1); px(ctx, ex + 2, ey + 2, C.eye); break;
      case 'wide': px(ctx, ex, ey - 1 + ly, C.eye, 2, 3); px(ctx, ex + 1, ey - 1 + ly, C.glint); break;
      case 'open': px(ctx, ex + lx, ey + ly, C.eye, 2, 2); px(ctx, ex + 1 + lx, ey + ly, C.glint); break;
      case 'sad': px(ctx, ex, ey + 1, C.eye, 2, 1); px(ctx, ex === eyesX[0] ? ex - 1 : ex, ey - 1, C.eye, 3, 1); px(ctx, ex === eyesX[0] ? ex - 1 : ex + 2, ey, C.eye); break;
      case 'focused': px(ctx, ex - 1, ey, C.eye, 4, 1); px(ctx, ex + lx, ey + 1, C.eye, 2, 1); break;
      default: // sleepy: heavy lid + half pupil
        px(ctx, ex - 1, ey, G.shade, 4, 1);
        px(ctx, ex - 1, ey + 1, C.eye, 4, 1);
        px(ctx, ex + lx, ey + 2, C.eye, 2, 1);
    }
  }
  if (p.cheeks !== false) { px(ctx, fxc - 6, ey + 3, C.cheek, 2, 1); px(ctx, fxc + 4, ey + 3, C.cheek, 2, 1); }
  const mx = fxc, my = ey + 4;
  switch (p.mouth) {
    case 'open': px(ctx, mx - 1, my, C.eye, 2, 2); break;
    case 'o': px(ctx, mx - 1, my, C.eye, 2, 1); break;
    case 'frown': px(ctx, mx - 2, my + 1, C.eye); px(ctx, mx - 1, my, C.eye, 2, 1); px(ctx, mx + 1, my + 1, C.eye); break;
    case 'flat': px(ctx, mx - 1, my, C.eye, 3, 1); break;
    case 'smile': px(ctx, mx - 2, my, C.eye); px(ctx, mx - 1, my + 1, C.eye, 2, 1); px(ctx, mx + 1, my, C.eye); break;
    default: px(ctx, mx - 1, my, C.eye, 2, 1); // small sleepy mouth
  }

  // soil + pot (in front of the cactus base)
  px(ctx, CX - 8, pt - 1, C.outline, 16, 1);
  px(ctx, CX - 8, pt, C.soil, 16, 1);
  // feet
  px(ctx, CX - 7, pb + 1 + feet[0], C.outline, 3, 2);
  px(ctx, CX + 4, pb + 1 + feet[1], C.outline, 3, 2);
  const inPot = (x, y) => {
    if (y < pt || y > pb) return false;
    const u = x + 0.5 - CX;
    if (y <= pt + 2) return Math.abs(u) <= 10;
    const t = (y - (pt + 3)) / (pb - pt - 3);
    return Math.abs(u) <= 8.5 - t * 1.8;
  };
  shape(ctx, CX - 11, pt, CX + 11, pb, inPot, (x, y) => {
    const u = (x + 0.5 - CX) / 9;
    if (y === pt + 2) return C.potShade;           // under-rim shadow
    if (u > 0.5) return C.potShade;
    if (u < -0.45 && u > -0.8) return C.potLight;
    return C.pot;
  });
  // soil showing above the rim
  px(ctx, CX - 9, pt, C.outline, 18, 1);

  // magnifier (review)
  if (p.lens) {
    const lx = eyesX[1] + 1 + p.lens.dx, ly = ey + p.lens.dy;
    const hand = p._hand || [lx + 6, ly + 6];
    stroke(ctx, lx + 3, ly + 3, hand[0], hand[1], 1.6, C.outline);
    stroke(ctx, lx + 3, ly + 3, hand[0], hand[1], 0.8, C.handle);
    const R = 4.2;
    for (let y = Math.floor(ly - R - 1); y <= ly + R + 1; y++) {
      for (let x = Math.floor(lx - R - 1); x <= lx + R + 1; x++) {
        const d = Math.hypot(x + 0.5 - (lx + 0.5), y + 0.5 - (ly + 0.5));
        if (d <= R - 1.5) px(ctx, x, y, C.glass);
        else if (d <= R - 0.5) px(ctx, x, y, C.brass);
        else if (d <= R + 0.5) px(ctx, x, y, C.outline);
      }
    }
    // magnified eye + glass glint
    px(ctx, lx - 1, ly - 1, C.eye, 3, 3);
    px(ctx, lx, ly - 1, C.glint);
    px(ctx, lx - 2, ly - 2, C.glint);
    // hand wrapped around the handle
    stroke(ctx, hand[0], hand[1], hand[0], hand[1], 2.5, C.outline);
    stroke(ctx, hand[0], hand[1], hand[0], hand[1], 1.5, G.green);
  }

  // extras
  const ex = p.extras || [];
  const topY = T - 4;
  if (ex.includes('z1')) sprite(ctx, ccx + 8, topY + 2, Z, { o: C.outline });
  if (ex.includes('z2')) sprite(ctx, ccx + 11, topY - 3, ['ooo', '.o.', 'ooo'], { o: C.outline });
  if (ex.includes('bang')) sprite(ctx, ccx - 14, topY - 1, BANG, { o: C.outline, y: C.sun });
  if (ex.includes('sweat1')) sprite(ctx, Math.round(sx(T + 3)) + 7, T + 1, DROP, { o: C.outline, c: C.drop, w: C.glint });
  if (ex.includes('sweat2')) sprite(ctx, Math.round(sx(T + 3)) - 11, T + 3, DROP, { o: C.outline, c: C.drop, w: C.glint });
  if (ex.includes('sweat3')) sprite(ctx, Math.round(sx(T + 3)) + 9, T - 3, DROP, { o: C.outline, c: C.drop, w: C.glint });
  if (ex.includes('puff')) sprite(ctx, fxc + 3, ey + 4, PUFF, { o: C.outline, w: '#e8eef2' });
}

// ---- animations -------------------------------------------------------------
const DOWN = { up: -70, out: 3, len: 5 };       // drooping arm

const ANIMS = {
  idle: (i, n) => ({
    grow: Math.round(wave(i, n) * 0.6),
    eyes: i === 3 ? 'closed' : 'sleepy',
    extras: i === 0 ? [] : i < 3 ? ['z1'] : i < 5 ? ['z1', 'z2'] : [],
  }),
  'running-right': (i) => ({
    bob: i % 2 ? 0 : -1, feet: i % 4 < 2 ? [-1, 0] : [0, -1], bend: -2, eyes: 'open', mouth: 'o',
    look: { x: 1, y: 0 }, armR: { up: i % 4 < 2 ? 100 : 80, out: 3, len: 5 }, armL: 60,
  }),
  'running-left': (i) => ({
    bob: i % 2 ? 0 : -1, feet: i % 4 < 2 ? [-1, 0] : [0, -1], bend: 2, eyes: 'open', mouth: 'o',
    look: { x: -1, y: 0 }, armR: { up: 60, out: 4, len: 6 }, armL: i % 4 < 2 ? 100 : 80,
  }),
  waving: (i) => ({
    armR: { up: [50, 75, 98, 75][i], out: 6, len: 7, elbowDy: -1 }, armL: i === 2 ? 70 : 90,
    eyes: i ? 'happy' : 'open', mouth: 'smile', grow: i === 2 ? 1 : 0,
  }),
  jumping: (i) => [
    { fat: 1, grow: -2, eyes: 'closed' },
    { grow: 1, bob: -5, eyes: 'open', mouth: 'open', armR: { up: 60, out: 4, len: 6 }, armL: 60 },
    { bob: -8, eyes: 'happy', mouth: 'smile', armR: { up: 50, out: 5, len: 6 }, armL: 50 },
    { grow: 1, bob: -4, eyes: 'open', mouth: 'o' },
    { fat: 1, grow: -2, eyes: 'happy', mouth: 'smile' },
  ][i],
  failed: (i) => [
    { eyes: 'wide', mouth: 'open', grow: 1, armR: { up: 60, out: 5, len: 6 }, armL: 60, extras: ['bang'] },
    { eyes: 'sad', mouth: 'frown', bend: 1, droop: 1, armR: { up: 30, out: 4, len: 5 } },
    { eyes: 'sad', mouth: 'frown', bend: 3, grow: -1, droop: 2, armR: { up: -20, out: 4, len: 4 }, armL: -20 },
    { eyes: 'sad', mouth: 'frown', bend: 5, grow: -3, droop: 3, armR: DOWN, armL: -50, pale: true },
    { eyes: 'sad', mouth: 'frown', bend: 6, grow: -4, droop: 4, armR: DOWN, armL: -70, pale: true },
    { eyes: 'closed', mouth: 'flat', bend: 6, grow: -4, droop: 4, armR: DOWN, armL: -70, pale: true, extras: ['puff'] },
    { eyes: 'sad', mouth: 'frown', bend: 6, grow: -5, droop: 4, armR: DOWN, armL: -70, pale: true },
    { eyes: 'sad', mouth: 'frown', bend: 6, grow: -5, droop: 4, armR: DOWN, armL: -70, pale: true },
  ][i],
  waiting: (i) => ({
    grow: [0, 1, 2, 1, 0, 0][i], eyes: 'wide', mouth: 'o', look: { x: 0, y: -0.6 },
    extras: i < 4 ? ['bang'] : [],
  }),
  running: (i) => ({
    grow: i % 2 ? 0 : 1, fat: i % 2 ? 0.5 : 0, eyes: 'focused', mouth: 'flat',
    armR: { up: i % 2 ? 80 : 100, out: 4, len: 6 }, armL: i % 2 ? 110 : 70,
    extras: [['sweat1'], ['sweat1', 'sweat2'], ['sweat3', 'sweat2'], ['sweat3'], ['sweat1'], ['sweat1', 'sweat2']][i],
  }),
  review: (i) => ({
    eyes: 'focused', mouth: 'flat', look: { x: [-0.5, -0.5, 0, 0.5, 0.5, 0][i], y: 0 },
    armR: { out: 4, elbowDy: 3, up: 0, len: 0, hand: [6, 3] }, lens: { dx: [-1, -1, 0, 1, 1, 0][i], dy: [0, 1, 0, 0, 1, 0][i] },
  }),
  look: (dir) => {
    const v = lookVector(dir);
    return { look: v, eyes: 'open', mouth: 'o', bend: Math.round(v.x * 1.5) };
  },
};

module.exports = {
  id: 'pricklet',
  displayName: 'Pricklet',
  description: 'A sleepy little cactus in a clay pot – waves, sweats while working, inspects with a tiny magnifier and wilts when something fails.',
  width: W,
  height: H,
  scale: 4,
  pixelated: true,
  draw(ctx, anim, frame, frames) {
    drawPet(ctx, ANIMS[anim](frame, frames));
  },
};

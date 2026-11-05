'use strict';

// TEMPLATE – a complete, working pet to start from. Copy it, rename it, then
// replace the look (palette + drawCharacter) and tune the poses.
//
//   node scripts/build-pet.js my-pet.js out/my-pet
//   node scripts/validate-pet.js out/my-pet
//   node scripts/preview-pet.js out/my-pet      → look at out/my-pet/preview.png
//
// Logical canvas: 38 × 41 pixels, drawn at 5× → 190 × 205 px inside the 192 × 208 cell.
// (0,0) is top-left. Keep the feet on GROUND in every grounded pose.
//
// The template is a reference for the module contract and a working example.
// For a character that isn't a round blob, rewriting the whole file is fine.
// All numbers below are tied to the 38 × 41 canvas – change W/H and they change too.

const { px, box, ellipse, limb, lookVector, wave } = require('pixie-pet-kit'); // provided by build-pet.js

const W = 38;
const H = 41;
const CX = 19;      // horizontal centre
const GROUND = 38;  // y of the shadow; feet stand just above it

// 1. Palette – 6–10 colours read best at this size.
const C = {
  outline: '#2b2440',
  body: '#7ec8e3',
  light: '#b9e6f5',
  shade: '#5aa6c4',
  eye: '#1d1a2b',
  glint: '#ffffff',
  cheek: '#f49ab0',
  accent: '#ffd166',
  shadow: 'rgba(0,0,0,0.18)',
};

// 2. The character in one pose. Everything an animation needs is a parameter.
//    p = { bob, jump, squash, dx, lean, eyes, look, mouth, arm, cheeks, extra }
//    bob  = body bounces, feet stay on the ground (breathing, working, waddling)
//    jump = everything leaves the ground, feet included (only for the jump row)
function drawCharacter(ctx, p = {}) {
  const jump = p.jump || 0;               // negative = up
  const bob = (p.bob || 0) + jump;        // body offset
  const squash = p.squash || 0;           // + wider/flatter, − taller
  const rx = 11 + squash;
  const ry = 10 - squash;
  const cx = CX + (p.dx || 0);
  const cy = GROUND - 2 - ry + bob;
  const top = cy - ry;
  const look = p.look || { x: 0, y: 0 };
  const face = { x: Math.round(look.x * 2), y: Math.round(look.y * 1.5) };

  // shadow shrinks while airborne
  const air = Math.min(4, Math.max(0, -jump));
  px(ctx, cx - 8 + air, GROUND, C.shadow, 16 - air * 2, 1);

  // feet: on the ground unless jumping; feet[i] = −1 lifts one foot (walking)
  const feet = p.feet || [0, 0];
  const footY = GROUND - 3 + jump;
  px(ctx, cx - 6, footY + feet[0], C.outline, 4, 3);
  px(ctx, cx + 2, footY + feet[1], C.outline, 4, 3);

  // Arm on the right side, drawn behind the body: angle in degrees above
  // horizontal (0 = pointing right, 90 = straight up). Above ~90° the arm points
  // inward and disappears behind the body. A left arm needs 180 − angle.
  if (p.arm !== undefined) {
    const a = (p.arm * Math.PI) / 180;
    limb(ctx, cx + rx - 4, cy, cx + rx - 4 + Math.cos(a) * 8, cy - Math.sin(a) * 8, 1.6, C.body, C.outline);
  }

  ellipse(ctx, cx, cy, rx, ry, { fill: C.body, outline: C.outline, light: C.light, shade: C.shade });

  // antenna (sways with lean)
  const lean = p.lean || 0;
  px(ctx, cx + lean, top - 3, C.outline, 1, 3);
  box(ctx, cx - 1 + lean, top - 5, 2, 2, C.accent, C.outline);

  // eyes
  const ey = cy - 3 + face.y;
  for (const ex of [cx - 6 + face.x, cx + 4 + face.x]) {
    switch (p.eyes) {
      case 'closed': px(ctx, ex - 1, ey + 2, C.eye, 4, 1); break;
      case 'happy': px(ctx, ex - 1, ey + 2, C.eye); px(ctx, ex, ey + 1, C.eye, 2, 1); px(ctx, ex + 2, ey + 2, C.eye); break;
      case 'wide': px(ctx, ex, ey - 1, C.eye, 2, 4); px(ctx, ex + 1, ey - 1, C.glint); break;
      case 'sad': px(ctx, ex, ey + 1, C.eye, 2, 2); px(ctx, ex - 1, ey - 1, C.eye, 4, 1); break;
      case 'focused': px(ctx, ex, ey + 1, C.eye, 2, 2); px(ctx, ex - 1, ey, C.outline, 4, 1); break;
      default: // open, pupils follow look
        px(ctx, ex + Math.round(look.x), ey + Math.round(look.y), C.eye, 2, 3);
        px(ctx, ex + 1 + Math.round(look.x), ey + Math.round(look.y), C.glint);
    }
  }
  if (p.cheeks) { px(ctx, cx - 8 + face.x, ey + 3, C.cheek, 2, 1); px(ctx, cx + 6 + face.x, ey + 3, C.cheek, 2, 1); }

  // mouth
  const mx = cx + face.x;
  const my = cy + 2 + face.y;
  switch (p.mouth) {
    case 'open': px(ctx, mx - 1, my, C.eye, 2, 2); break;
    case 'frown': px(ctx, mx - 2, my + 1, C.eye); px(ctx, mx - 1, my, C.eye, 2, 1); px(ctx, mx + 1, my + 1, C.eye); break;
    case 'flat': px(ctx, mx - 1, my + 1, C.eye, 2, 1); break;
    default: px(ctx, mx - 2, my, C.eye); px(ctx, mx - 1, my + 1, C.eye, 2, 1); px(ctx, mx + 1, my, C.eye); // smile
  }

  // little extras that make states readable
  if (p.extra === 'bang') { box(ctx, cx - 14, top - 6, 2, 4, C.accent, C.outline); box(ctx, cx - 14, top, 2, 2, C.accent, C.outline); }
  if (p.extra === 'sweat') { px(ctx, cx + 10, top + 3, '#8fd3ff'); px(ctx, cx + 9, top + 4, '#8fd3ff', 3, 2); }
  if (p.extra === 'sparkle') { px(ctx, cx - 14, top + 2, C.accent); px(ctx, cx + 14, top, C.accent); px(ctx, cx + 11, top - 5, C.accent); }
}

// 3. One function per animation: frame i of n → pose. Careful with the names:
//    'running-right' / 'running-left' = walking (rows 2–3), 'running' = WORKING (row 8).
const ANIMS = {
  idle: (i, n) => ({ bob: Math.round(wave(i, n) * 0.8), eyes: i === 3 ? 'closed' : 'open', lean: Math.round(wave(i, n)) }),
  'running-right': (i) => ({ bob: i % 2 ? 0 : -1, squash: i % 2 ? 1 : 0, feet: i % 4 < 2 ? [-1, 0] : [0, -1], look: { x: 1, y: 0 }, lean: -1 }),
  'running-left': (i) => ({ bob: i % 2 ? 0 : -1, squash: i % 2 ? 1 : 0, feet: i % 4 < 2 ? [-1, 0] : [0, -1], look: { x: -1, y: 0 }, lean: 1 }),
  waving: (i) => ({ arm: [-20, 20, 60, 20][i], eyes: i ? 'happy' : 'open', cheeks: i > 0, bob: i === 2 ? -1 : 0 }),
  jumping: (i) => [
    { squash: 2, eyes: 'happy' },                  // start: crouch
    { squash: -1, jump: -4, mouth: 'open' },       // rise: stretch
    { jump: -7, eyes: 'happy', extra: 'sparkle' }, // peak
    { squash: -1, jump: -3 },                      // fall
    { squash: 3, eyes: 'happy', cheeks: true },    // land: squash
  ][i],
  failed: (i) => ({ eyes: i === 0 ? 'wide' : i % 4 === 2 ? 'closed' : 'sad', mouth: i === 0 ? 'open' : 'frown', squash: Math.min(2, i), extra: i === 4 ? 'sweat' : undefined }),
  waiting: (i) => ({ bob: [0, -1, -2, -1, 0, 0][i], eyes: 'wide', mouth: 'open', look: { x: 0, y: -1 }, extra: i < 4 ? 'bang' : undefined }),
  // row 8 = working / thinking, not walking
  running: (i) => ({ bob: i % 2 ? 0 : -1, squash: i % 2 ? 1 : 0, feet: i % 4 < 2 ? [-1, 0] : [0, -1], eyes: 'focused', mouth: 'flat', extra: i < 3 ? 'sweat' : undefined }),
  review: (i) => ({ eyes: 'focused', look: { x: [-1, -1, 0, 1, 1, 0][i], y: 0 }, mouth: 'flat' }),
  look: (dir) => ({ look: lookVector(dir), dx: Math.round(lookVector(dir).x) }),
};

module.exports = {
  id: 'my-pet',
  displayName: 'My Pet',
  description: 'A short sentence about the pet.',
  width: W,
  height: H,
  scale: 5,
  pixelated: true,
  draw(ctx, anim, frame, frames) {
    drawCharacter(ctx, ANIMS[anim](frame, frames));
  },
};

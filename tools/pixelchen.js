'use strict';

// Pixelchen, drawn pixel by pixel for every cell of the Codex pet atlas
// (8 columns × 11 rows, 192 × 208 px per cell; Pixelchen uses 38 × 41 logical
// pixels at 5× = 190 × 205, centred horizontally and standing on the bottom).
// Built with: node skills/pixie-pet/scripts/build-pet.js tools/pixelchen.js pets/pixelchen
// The app itself only plays the resulting sheet.

const CELL_W = 38;
const CELL_H = 41;
const CX = 19;
const GROUND = 38;

const THEME = {
  outline: '#33232c',
  body: '#e8875b',
  light: '#f6b08e',
  shade: '#c56843',
  eye: '#2a1d25',
  glint: '#ffffff',
  cheek: '#f4939b',
  leaf: '#6dbb6a',
  leafDark: '#3f8a4a',
  accent: '#ffd166',
  sweat: '#8fd3ff',
  shadow: 'rgba(0,0,0,0.18)',
  puff: '#e9eef2',
};

function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function outlined(ctx, th, x, y, w, h, color) {
  px(ctx, x - 1, y - 1, th.outline, w + 2, h + 2);
  px(ctx, x, y, color, w, h);
}

function drawBody(ctx, th, cx, cy, rx, ry) {
  const inside = (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c = th.body;
      if (edge) c = th.outline;
      else {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (ny > 0.55) c = th.shade;
        else if (nx < -0.2 && ny < -0.15 && nx * nx + ny * ny < 0.62) c = th.light;
      }
      px(ctx, x, y, c);
    }
  }
}

function drawSprout(ctx, th, cx, top, sway, droop) {
  px(ctx, cx, top - 1, th.leafDark);
  px(ctx, cx, top - 2, th.leafDark);
  if (droop) {
    px(ctx, cx + 1, top - 2, th.leaf, 2, 1);
    px(ctx, cx + 3, top - 1, th.leaf, 2, 1);
    px(ctx, cx - 2, top - 2, th.leaf, 2, 1);
    px(ctx, cx - 4, top - 1, th.leaf, 2, 1);
    return;
  }
  px(ctx, cx + 1, top - 3, th.leaf, 2, 1);
  px(ctx, cx + 2 + sway, top - 4, th.leaf, 2, 1);
  px(ctx, cx + 1, top - 2, th.leafDark);
  px(ctx, cx - 2, top - 3, th.leaf, 2, 1);
  px(ctx, cx - 3 + sway, top - 4, th.leaf, 2, 1);
}

function drawEye(ctx, th, ex, ey, style, look, isLeft) {
  const lx = look.x || 0;
  const ly = look.y || 0;
  switch (style) {
    case 'closed':
      px(ctx, ex - 1, ey + 2, th.eye, 4, 1);
      break;
    case 'blink':
      px(ctx, ex, ey + 2, th.eye, 2, 1);
      break;
    case 'happy':
      px(ctx, ex - 1, ey + 2, th.eye);
      px(ctx, ex, ey + 1, th.eye, 2, 1);
      px(ctx, ex + 2, ey + 2, th.eye);
      break;
    case 'wide':
      px(ctx, ex + lx, ey - 1 + ly, th.eye, 2, 4);
      px(ctx, ex + 1 + lx, ey - 1 + ly, th.glint);
      break;
    case 'sad':
      px(ctx, ex, ey + 1, th.eye, 2, 2);
      px(ctx, ex + 1, ey + 1, th.glint);
      if (isLeft) { px(ctx, ex - 1, ey - 1, th.eye); px(ctx, ex, ey - 2, th.eye, 2, 1); }
      else { px(ctx, ex + 2, ey - 1, th.eye); px(ctx, ex, ey - 2, th.eye, 2, 1); }
      break;
    case 'squint':
      px(ctx, ex + lx, ey + 1, th.eye, 2, 2);
      px(ctx, ex - 1, ey, th.eye, 4, 1);
      break;
    default: // open
      px(ctx, ex + lx, ey + ly, th.eye, 2, 3);
      px(ctx, ex + 1 + lx, ey + ly, th.glint);
  }
}

function drawMouth(ctx, th, cx, my, style) {
  switch (style) {
    case 'smile':
      px(ctx, cx - 2, my, th.eye);
      px(ctx, cx - 1, my + 1, th.eye, 2, 1);
      px(ctx, cx + 1, my, th.eye);
      break;
    case 'big':
      px(ctx, cx - 2, my, th.eye, 4, 1);
      px(ctx, cx - 1, my + 1, th.eye, 2, 1);
      break;
    case 'o':
      px(ctx, cx - 1, my, th.eye, 2, 2);
      break;
    case 'frown':
      px(ctx, cx - 2, my + 1, th.eye);
      px(ctx, cx - 1, my, th.eye, 2, 1);
      px(ctx, cx + 1, my + 1, th.eye);
      break;
    case 'tiny':
      px(ctx, cx - 1, my, th.eye, 2, 1);
      break;
    default: // flat
      px(ctx, cx - 1, my + 1, th.eye, 2, 1);
  }
}

// Stubby arm from behind the right side of the body; angle in degrees above horizontal.
function drawArm(ctx, th, sx, sy, angle) {
  const a = (angle * Math.PI) / 180;
  const hx = sx + Math.cos(a) * 9;
  const hy = sy - Math.sin(a) * 9;
  const disc = (x0, y0, r, color) => {
    for (let y = Math.floor(y0 - r); y <= Math.ceil(y0 + r); y++) {
      for (let x = Math.floor(x0 - r); x <= Math.ceil(x0 + r); x++) {
        if ((x + 0.5 - x0) ** 2 + (y + 0.5 - y0) ** 2 <= r * r) px(ctx, x, y, color);
      }
    }
  };
  for (const [r, color] of [[2.6, th.outline], [1.6, th.body]]) {
    for (let t = 0; t <= 1.0001; t += 0.1) disc(sx + (hx - sx) * t, sy + (hy - sy) * t, r, color);
  }
}

function sparkle(ctx, th, x, y, big) {
  px(ctx, x, y, th.accent);
  if (big) {
    px(ctx, x - 1, y, th.accent); px(ctx, x + 1, y, th.accent);
    px(ctx, x, y - 1, th.accent); px(ctx, x, y + 1, th.accent);
  }
}

// p: { dx, bob, rx, ry, feet, eyes, look, face, mouth, cheeks, sway, droop, arm, fx: {...} }
function drawPose(ctx, p, th = THEME) {
  const rx = p.rx ?? 12;
  const ry = p.ry ?? 10;
  const bob = p.bob || 0;
  const cx = CX + (p.dx || 0);
  const cy = GROUND - 2 - ry + bob;
  const top = cy - ry;
  const feet = p.feet || [0, 0];
  const face = p.face || { x: 0, y: 0 };
  const fx = p.fx || {};

  const air = Math.min(4, -bob);
  px(ctx, cx - 8 + air, GROUND, th.shadow, 16 - air * 2, 1);
  px(ctx, cx - 6 + air, GROUND + 1, th.shadow, 12 - air * 2, 1);

  px(ctx, cx - 7, cy + ry - 2 + feet[0], th.outline, 4, 3);
  px(ctx, cx + 3, cy + ry - 2 + feet[1], th.outline, 4, 3);

  if (p.arm !== undefined) drawArm(ctx, th, cx + rx - 5, cy - 1, p.arm);
  drawBody(ctx, th, cx, cy, rx, ry);
  drawSprout(ctx, th, cx, top, p.sway || 0, p.droop);

  const ey = cy - 3 + face.y;
  const exL = cx - 6 + face.x;
  const exR = cx + 4 + face.x;
  const look = p.look || { x: 0, y: 0 };
  drawEye(ctx, th, exL, ey, p.eyes || 'open', look, true);
  drawEye(ctx, th, exR, ey, p.eyes || 'open', look, false);
  if (p.cheeks) {
    px(ctx, exL - 2, ey + 3, th.cheek, 2, 1);
    px(ctx, exR + 2, ey + 3, th.cheek, 2, 1);
  }
  drawMouth(ctx, th, cx + face.x, cy + 2 + face.y, p.mouth || 'smile');

  if (fx.sweat) {
    px(ctx, cx + 11, top + 3, th.sweat);
    px(ctx, cx + 10, top + 4, th.sweat, 3, 2);
  }
  if (fx.motion) {
    const k = fx.k || 0;
    const sides = fx.motion === 'both' ? ['L', 'R'] : [fx.motion];
    if (sides.includes('L')) {
      px(ctx, cx - rx - 3 - k, cy - 2, th.outline, 2, 1);
      px(ctx, cx - rx - 2 - k, cy + 1, th.outline, 2, 1);
    }
    if (sides.includes('R')) {
      px(ctx, cx + rx + 1 + k, cy - 2, th.outline, 2, 1);
      px(ctx, cx + rx + k, cy + 1, th.outline, 2, 1);
    }
  }
  if (fx.bang) {
    outlined(ctx, th, cx - 13, top - 7, 2, 4, th.accent);
    outlined(ctx, th, cx - 13, top - 1, 2, 2, th.accent);
  }
  if (fx.dots) {
    const dots = [[cx + 10, top, 1], [cx + 13, top - 3, 2], [cx + 16, top - 7, 2]];
    dots.slice(0, fx.dots).forEach(([x, y, s]) => outlined(ctx, th, x, y, s, s, '#ffffff'));
  }
  if (fx.sparkles) {
    const spots = [[cx - 15, top + 3], [cx + 15, top + 1], [cx - 10, top - 5], [cx + 10, top - 6]];
    spots.forEach(([x, y], i) => sparkle(ctx, th, x, y, (i + fx.sparkles) % 2 === 0));
  }
  if (fx.puff) {
    const s = fx.puff;
    outlined(ctx, th, cx + rx + s - 1, cy - 2 - s * 2, 1 + s, 1 + s, th.puff);
  }
}

// ---------- animation rows (Codex order) ----------

const RUN = (dir) => Array.from({ length: 8 }, (_, i) => {
  const up = i % 2 === 0;
  return {
    bob: up ? -1 : 0,
    rx: up ? 12 : 13,
    ry: up ? 10 : 9,
    feet: i % 4 < 2 ? [-1, 0] : [0, -1],
    face: { x: 2 * dir, y: 0 },
    look: { x: dir, y: 0 },
    eyes: i === 5 ? 'blink' : 'open',
    mouth: 'smile',
    sway: -dir,
    fx: { motion: dir > 0 ? 'L' : 'R', k: i % 2 },
  };
});

function lookPose(k) {
  const a = (k * Math.PI) / 8; // clockwise from "up"
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  return {
    dx: Math.round(sx),
    face: { x: Math.round(sx * 2), y: Math.round(sy * 2) },
    look: { x: Math.round(sx), y: Math.round(sy) },
    eyes: 'open',
    mouth: 'smile',
    sway: -Math.round(sx),
  };
}

const ROWS = [
  // 1 idle: breathe + blink (6)
  [0, 0, -1, -1, -1, 0].map((bob, i) => ({
    bob, eyes: i === 3 ? 'blink' : 'open', mouth: 'smile', sway: [0, 1, 1, 0, -1, -1][i],
  })),
  // 2 run right (8), 3 run left (8)
  RUN(1),
  RUN(-1),
  // 4 wave (4)
  [-25, 20, 60, 20].map((arm, i) => ({
    arm, bob: i === 2 ? -1 : 0, eyes: i ? 'happy' : 'open', mouth: i ? 'big' : 'smile', cheeks: i > 0, sway: i % 2,
  })),
  // 5 jump: start, rise, peak, fall, land (5)
  [
    { rx: 13, ry: 9, eyes: 'happy', mouth: 'smile', feet: [0, 0] },
    { rx: 11, ry: 11, bob: -4, eyes: 'open', mouth: 'o', sway: -1 },
    { bob: -7, eyes: 'happy', mouth: 'big', cheeks: true, sway: 1, fx: { sparkles: 1 } },
    { rx: 11, ry: 11, bob: -3, eyes: 'open', mouth: 'smile', sway: 1 },
    { rx: 14, ry: 8, eyes: 'happy', mouth: 'smile', cheeks: true },
  ],
  // 6 failed / disappointed (8)
  [
    { eyes: 'wide', mouth: 'o' },
    { eyes: 'sad', mouth: 'frown' },
    { rx: 12.5, ry: 9.5, eyes: 'sad', mouth: 'frown', droop: true },
    { rx: 13, ry: 9, eyes: 'sad', mouth: 'frown', droop: true, face: { x: 0, y: 1 } },
    { rx: 13, ry: 9, eyes: 'sad', mouth: 'frown', droop: true, face: { x: 0, y: 1 }, fx: { sweat: true } },
    { rx: 13, ry: 9, eyes: 'closed', mouth: 'flat', droop: true, face: { x: 0, y: 1 }, fx: { puff: 1 } },
    { rx: 13.5, ry: 8.5, eyes: 'closed', mouth: 'flat', droop: true, face: { x: 0, y: 1 }, fx: { puff: 2 } },
    { rx: 13, ry: 9, eyes: 'sad', mouth: 'frown', droop: true, face: { x: 0, y: 1 } },
  ],
  // 7 waiting for input (6)
  [0, -1, -2, -1, 0, 0].map((bob, i) => ({
    bob, eyes: 'wide', look: { x: 0, y: -1 }, mouth: i < 3 ? 'o' : 'smile', sway: i % 2, fx: { bang: i < 4 },
  })),
  // 8 focused work / thinking (6)
  Array.from({ length: 6 }, (_, i) => {
    const up = i % 2 === 0;
    return {
      bob: up ? -1 : 0, rx: up ? 12 : 13, ry: up ? 10 : 9,
      feet: i % 4 < 2 ? [-1, 0] : [0, -1],
      eyes: i === 4 ? 'blink' : 'open', look: { x: 0, y: 1 }, mouth: 'flat',
      fx: { sweat: i < 3, motion: 'both', k: i % 2 },
    };
  }),
  // 9 attentive review (6)
  [-1, -1, 0, 1, 1, 0].map((x, i) => ({
    eyes: 'squint', look: { x, y: 0 }, face: { x, y: 0 }, mouth: 'tiny', sway: x, fx: { dots: [1, 2, 3, 3, 2, 1][i] },
  })),
  // 10 look: up → right → lower right (8), 11 look: down → left → upper left (8)
  Array.from({ length: 8 }, (_, i) => lookPose(i)),
  Array.from({ length: 8 }, (_, i) => lookPose(i + 8)),
];

// ---------- pet module interface (see skills/pixie-pet/scripts/build-pet.js) ----------

const ANIM_ROW = {
  idle: 0, 'running-right': 1, 'running-left': 2, waving: 3, jumping: 4,
  failed: 5, waiting: 6, running: 7, review: 8,
};

module.exports = {
  id: 'pixelchen',
  displayName: 'Pixelchen',
  description: 'A little pixel sprout that keeps an eye on what Claude is doing.',
  width: CELL_W,
  height: CELL_H,
  scale: 5,
  pixelated: true,
  draw(ctx, anim, frame) {
    const pose = anim === 'look' ? ROWS[9 + Math.floor(frame / 8)][frame % 8] : ROWS[ANIM_ROW[anim]][frame];
    drawPose(ctx, pose);
  },
  ROWS,
  drawPose,
};

'use strict';

// Drawing helpers for pixel-art pets. Every helper takes the cell context
// (`ctx`, which has a canvas-like fillStyle/fillRect) as first argument and
// works in logical pixels. Colours are '#rrggbb' or 'rgba(r,g,b,a)'.

function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// Filled box with a 1-px outline around it.
function box(ctx, x, y, w, h, fill, outline) {
  px(ctx, x - 1, y - 1, outline, w + 2, h + 2);
  px(ctx, x, y, fill, w, h);
}

// Filled ellipse with outline and simple top-left light / bottom shade.
// shading: { light, shade } colours, both optional.
function ellipse(ctx, cx, cy, rx, ry, { fill, outline, light, shade } = {}) {
  const inside = (x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c = fill;
      if (edge && outline) c = outline;
      else {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (shade && ny > 0.55) c = shade;
        else if (light && nx < -0.2 && ny < -0.15 && nx * nx + ny * ny < 0.62) c = light;
      }
      px(ctx, x, y, c);
    }
  }
}

// Thick line made of discs (arms, legs, tails, antennas).
function stroke(ctx, x0, y0, x1, y1, radius, color) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius * radius) px(ctx, x, y, color);
      }
    }
  }
}

// Any shape with a 1-px outline: inside(x, y) → boolean, colorAt(x, y) → fill colour.
//   shape(ctx, (x, y) => …, () => '#7c5', '#222', { x0: 0, y0: 0, x1: 38, y1: 41 })
function shape(ctx, inside, colorAt, outline, { x0 = 0, y0 = 0, x1 = 64, y1 = 64 } = {}) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      px(ctx, x, y, edge && outline ? outline : colorAt(x, y));
    }
  }
}

// Outlined limb (arm, leg, tail): a thick line with a 1-px outline.
function limb(ctx, x0, y0, x1, y1, radius, fill, outline) {
  stroke(ctx, x0, y0, x1, y1, radius + 1, outline);
  stroke(ctx, x0, y0, x1, y1, radius, fill);
}

// Draw a small bitmap: rows of characters, each mapped to a colour.
// '.' and any character without a colour in `colors` are transparent.
//   sprite(ctx, x, y, ['.oo.', 'oxxo'], { o: '#333', x: '#f80' })
function sprite(ctx, x, y, rows, colors, { flipX = false } = {}) {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = colors[ch];
      if (c) px(ctx, x + (flipX ? row.length - 1 - i : i), y + j, c);
    });
  });
}

// Direction 0–15 (clockwise from "up") → unit vector { x, y } (screen y points down).
function lookVector(direction) {
  const a = (direction * Math.PI) / 8;
  return { x: Math.sin(a), y: -Math.cos(a) };
}

// Smooth 0→1→0 over a loop; handy for breathing/bobbing: wave(frame, frames)
function wave(frame, frames, phase = 0) {
  return Math.sin(((frame / frames) + phase) * Math.PI * 2);
}

module.exports = { px, box, ellipse, shape, stroke, limb, sprite, lookVector, wave };

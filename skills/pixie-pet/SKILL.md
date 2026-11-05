---
name: pixie-pet
description: Design and build a custom animated desktop pet for Pixie (and Codex), as a spritesheet in the Codex pet format. Use when the user wants to create, draw, change or fix a pet, or turn frames/images into a pet spritesheet.
---

# Making a pet for Pixie

A pet is a folder with `pet.json` and `spritesheet.png` (or `.webp`). The spritesheet is a grid of **8 columns × 11 rows**, each cell **192 × 208 px**, transparent background (1536 × 2288 px). Pixie and Codex pick the right row for what the agent is doing, so every row must read clearly at a glance – the pet is shown at about 125 × 135 px.

You (Claude) can build a complete pet yourself by **drawing it in code** as pixel art with the scripts in this skill. No image generator needed, and every frame stays consistent because it is the same drawing with different parameters.

## The rows

| Row | `anim` | Frames | What it must show |
|---|---|---|---|
| 1 | `idle` | 6 | Resting: gentle breathing, one blink. Loops; frame 1 is also shown between loops, so make it neutral. |
| 2 | `running-right` | 8 | Running/walking to the right (pet is being dragged). Facing right, feet alternate. No legs? Hop, wobble, roll or give it tiny feet. |
| 3 | `running-left` | 8 | Same to the left (a mirror of row 2 is fine). |
| 4 | `waving` | 4 | Friendly wave – hand, paw, wing, tentacle, antenna… whatever fits. Played once or twice as greeting / to get attention. |
| 5 | `jumping` | 5 | Start (crouch) → rise (stretch) → peak (highest) → fall → land (squash). Feet leave the ground in rise/peak/fall; **start and landing stand on the idle baseline**, so it flows back into idle. Played once when clicked. |
| 6 | `failed` | 8 | Disappointed/blocked: surprise → slump → sigh. Clearly sad, not angry. **Played once, then the last frame is held** – make frame 8 a calm, sad resting pose (it does not need to loop back). |
| 7 | `waiting` | 6 | Waiting for the user's input: attentive, expectant, maybe a "!" or a small hop. |
| 8 | `running` | 6 | **Working** hard / thinking (despite the name – not walking): busy, focused (typing, gears, sweat drop, scribbling). |
| 9 | `review` | 6 | Looking over a finished result: inspecting, squinting, nodding, magnifier. |
| 10 | `look` 0–7 | 8 | Looking up, then clockwise: up-right, right (4), down-right. |
| 11 | `look` 8–15 | 8 | Looking down (8), then clockwise: down-left, left (12), up-left. |

Rows 10–11 are single frames picked by mouse direction (not played as an animation): only the gaze/head changes, the body stays put. Unused cells at the end of a row must stay fully transparent.

## Rules that make a pet look good

- **Same character in every frame.** Same palette, proportions, outline thickness. Only pose and expression change.
- **Feet on one line.** In the grounded rows (1, 6, 8–11) the lowest solid pixel stays at the same height, otherwise the pet jitters. Let the *body* bob and squash, keep the *feet* planted (the template separates `bob` from `jump`). Only the jump, the walk cycle and a small hop in "waiting" may leave the ground. Soft shadows don't count – the validator ignores semi-transparent pixels here.
- **Centred, with headroom.** Keep the idle pose centred and leave ~30 px above the head for jumps, waves and effects. Nothing may touch the cell edges.
- **Readable at small size.** Big head/eyes, a clear silhouette, 6–10 colours, a 1-px dark outline. Emotions live in the eyes and mouth.
- **Loops loop.** Idle, both walk rows, waiting, working and review repeat – their last frame should lead back into the first. Waving and jumping are played once (or twice) and failed holds its last frame.
- **Original characters only.** Don't recreate characters, mascots or logos owned by others (no famous cartoon figures, no company mascots, no brand logos) – also not "in the style of" with the same recognisable features. Invent something new; that's the fun part.

## Workflow

### 1. Agree on the character (briefly)

If the user hasn't described it, ask at most one short question (what creature/object, a colour, a personality word) – or propose one idea and go. Decide:
- what it is and how it **waves** (hand, paw, wing, antenna, a little flag…),
- how it shows **working** (typing, gears, sweat, glowing), **review** (magnifier, squint) and **failed** (droop, cloud, sigh),
- a palette of 6–10 colours.

### 2. Start from the template

```bash
SKILL=<path to this skill folder>
mkdir -p work && cp "$SKILL/templates/pet-template.js" work/<id>.js
```

The template is a working example and a reference for the module contract. For a round character, edit it; for anything else (a plant in a pot, a robot, an animal with long ears) rewriting `drawCharacter()` – or the whole file – is normal. Its numbers are tied to its 38 × 41 canvas.

Edit `work/<id>.js`: set `id` (lowercase, dashes), `displayName`, `description`, then replace the palette and `drawCharacter()` with your design and adapt the per-animation poses in `ANIMS`. Drawing helpers come from `require('pixie-pet-kit')` (= `scripts/pixel.js`, provided by the build script wherever your file lives): `px`, `box`, `ellipse` (with outline + light/shade), `shape` (any outlined shape from an `inside(x, y)` test), `limb` (outlined arm/leg/tail), `stroke` (plain thick line), `sprite` (draw from ASCII art rows), `lookVector(dir)`, `wave(i, n)`.

**Limbs:** an angle "above horizontal" on the right side points the other way when you mirror it for a left limb (use `180 − angle`), and above ~90° an arm drawn behind the body bends inward and disappears. Build once and check the wave row first.

The module contract (see `scripts/build-pet.js`): `width`, `height`, `scale` (logical canvas; `width*scale ≤ 192`, `height*scale ≤ 208`; the template uses 38 × 41 at 5×), and `draw(ctx, anim, frame, frames)`. For `look`, `frame` is the direction 0–15. The canvas sits centred on the bottom edge of the cell.

For more detail or a non-blob shape, the `sprite()` helper lets you draw from character maps (one string per pixel row), which is great for hand-placed pixel art. You can also use a smaller scale for finer detail, e.g. 4× with a 48 × 52 canvas – that fills the whole cell, so keep your own margins (≈ 6 px headroom, nothing on the edges).

A second, complete example that is *not* a blob: `examples/pricklet.js` (a cactus in a pot – fixed pot, the plant bends and wilts, a magnifier prop, sleepy "z"s). It was made with this skill.

### 3. Build, validate, look – repeat

```bash
node "$SKILL/scripts/build-pet.js"    work/<id>.js out/<id>
node "$SKILL/scripts/validate-pet.js" out/<id>
node "$SKILL/scripts/preview-pet.js"  out/<id>                 # → out/<id>-preview.png (whole sheet)
node "$SKILL/scripts/preview-pet.js"  out/<id> --rows 4-6      # → close-up of rows 4–6 at full size
```

**Always look at the previews** before you call the pet done. The whole-sheet preview is small – use it for consistency, the green baseline and empty cells. Then open close-ups (`--rows`) of the rows you changed and check faces, props and limbs: does each row say what it should? Is it the same character everywhere? Is anything cut off? Fix and rebuild until the validator passes without warnings you can avoid and the previews look right. Expect 2–4 rounds.

### 4. Install

- **Claude Code / local machine:** copy the folder to `~/.pixie/pets/<id>/` (create it if needed). In Pixie: right-click → Pet → *Rescan pets*, then select it. It also works in Codex: copy to `~/.codex/pets/<id>/`.
- **No access to the user's machine** (e.g. the Claude app): zip `out/<id>/` and give it to the user with those two folder paths.

The previews are written next to the pet folder, so the folder itself only contains `pet.json` and `spritesheet.png` – ship exactly that.

### 5. Hand over

Show the preview image, say in one or two sentences what the pet does in which state, and how to install it.

## Pets from images instead of code

If the user has drawn frames in an art program, or made them with an image generator:

1. Frames as transparent PNGs named `<anim>-<n>.png`, n from 1: `idle-1…6`, `running-right-1…8`, `running-left-1…8` (optional – mirrored from right if missing), `waving-1…4`, `jumping-1…5`, `failed-1…8`, `waiting-1…6`, `running-1…6`, `review-1…6`, `look-1…16` (look-1 = up, clockwise; look-5 right, look-9 down, look-13 left). Max 192 × 208 px each; smaller frames are centred on the bottom edge.
2. `node "$SKILL/scripts/assemble-pet.js" frames/ out/<id> --id <id> --name "<Name>"`
3. Validate and preview as above.

For drawing a whole sheet by hand, `node "$SKILL/scripts/assemble-pet.js" --template grid.png` makes an empty 1536 × 2288 guide layer (cells, suggested feet line, centre line, cells to leave empty).

Image generators often break consistency between frames (the character changes) and rarely produce real transparency – check the preview carefully and tell the user honestly if frames don't match.

## Troubleshooting

| Validator says | Fix |
|---|---|
| background is not transparent | export with alpha; remove the background colour |
| feet move … away from the idle baseline | keep the feet planted in grounded rows; bob/squash only the body |
| touches the cell edge | make the pet smaller or move effects inward |
| N frames, but the format has M | extra cells must be empty – check the frame count per row |
| pet is only N px tall | increase `scale` or the logical size |
| WebP can only be checked for size | validate the PNG, convert to WebP afterwards (optional – PNG works everywhere) |

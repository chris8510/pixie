'use strict';

// Finds installed pets. A pet is a folder with an optional pet.json
// ({ id, displayName, description, spritesheetPath }) and a spritesheet –
// exactly the layout Codex uses in ~/.codex/pets/<id>/.

const fs = require('fs');
const os = require('os');
const path = require('path');

const MIME = { '.webp': 'image/webp', '.png': 'image/png' };
const MAX_SHEET_BYTES = 25 * 1024 * 1024;

function petRoots({ appDir, home = os.homedir(), env = process.env } = {}) {
  return [
    { dir: path.join(appDir, 'pets'), source: 'builtin' },
    { dir: path.join(home, '.pixie', 'pets'), source: 'user' },
    { dir: path.join(env.CODEX_HOME || path.join(home, '.codex'), 'pets'), source: 'codex' },
  ];
}

function readManifest(dir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, 'pet.json'), 'utf8'));
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

// Returns { file } or { reason }. The sheet may live anywhere (absolute or
// relative path) – we only ever read it as an image, so PNG/WebP is required.
function findSheet(dir, manifest) {
  const candidates = manifest.spritesheetPath
    ? [manifest.spritesheetPath]
    : ['spritesheet.webp', 'spritesheet.png'];
  for (const rel of candidates) {
    const abs = path.resolve(dir, String(rel).replace(/^~(?=$|[\\/])/, os.homedir()));
    if (!MIME[path.extname(abs).toLowerCase()]) return { reason: `${rel}: only .png or .webp` };
    try {
      if (fs.statSync(abs).isFile()) return { file: abs };
    } catch { /* missing */ }
  }
  return { reason: `${candidates.join(' / ')} not found` };
}

// { pets, skipped: [{ dir, reason }] }
function scanPets(roots) {
  const pets = [];
  const skipped = [];
  const seen = new Set();
  for (const { dir, source } of roots) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const name of entries.sort()) {
      if (name.startsWith('.')) continue;
      const petDir = path.join(dir, name);
      try { if (!fs.statSync(petDir).isDirectory()) continue; } catch { continue; }
      const manifest = readManifest(petDir);
      const { file: sheetPath, reason } = findSheet(petDir, manifest);
      if (!sheetPath) {
        skipped.push({ dir: petDir, source, reason });
        continue;
      }
      const id = String(manifest.id || name);
      if (seen.has(id)) {
        skipped.push({ dir: petDir, source, reason: `id "${id}" already used` });
        continue;
      }
      seen.add(id);
      pets.push({
        id,
        displayName: String(manifest.displayName || manifest.name || name),
        description: manifest.description ? String(manifest.description) : '',
        pixelated: manifest.pixelated === true,
        source,
        dir: petDir,
        sheetPath,
      });
    }
  }
  return { pets, skipped };
}

const discoverPets = (roots) => scanPets(roots).pets;

function sheetDataUrl(pet) {
  const { size } = fs.statSync(pet.sheetPath);
  if (size > MAX_SHEET_BYTES) throw new Error(`Spritesheet ist zu groß (${Math.round(size / 1e6)} MB)`);
  const mime = MIME[path.extname(pet.sheetPath).toLowerCase()];
  return `data:${mime};base64,${fs.readFileSync(pet.sheetPath).toString('base64')}`;
}

module.exports = { petRoots, discoverPets, scanPets, sheetDataUrl };

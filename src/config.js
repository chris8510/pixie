'use strict';

// Settings live in ~/.pixie/config.json (created from config.default.json on
// first start), so they survive app updates and are easy to find and edit.

const fs = require('fs');
const os = require('os');
const path = require('path');

const PIXIE_HOME = process.env.PIXIE_HOME || path.join(os.homedir(), '.pixie');
const USER_CONFIG = path.join(PIXIE_HOME, 'config.json');
const DEFAULT_CONFIG = path.join(__dirname, '..', 'config.default.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadConfig() {
  const defaults = readJSON(DEFAULT_CONFIG);
  let user = {};
  try {
    if (!fs.existsSync(USER_CONFIG)) {
      fs.mkdirSync(PIXIE_HOME, { recursive: true });
      fs.copyFileSync(DEFAULT_CONFIG, USER_CONFIG);
    }
    user = readJSON(USER_CONFIG);
  } catch (err) {
    console.error(`${USER_CONFIG}: ${err.message} – using defaults`);
  }
  return { ...defaults, ...user, voice: { ...defaults.voice, ...(user.voice || {}) } };
}

function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

module.exports = { PIXIE_HOME, USER_CONFIG, loadConfig, expandHome };

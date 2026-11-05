#!/usr/bin/env node
'use strict';

// CLI alternative to the app's "Connect to Claude Code" menu item.
//   node scripts/install-hooks.js            add the Pixie hooks
//   node scripts/install-hooks.js --uninstall remove them

const fs = require('fs');
const hooks = require('../src/hooks');
const { USER_CONFIG } = require('../src/config');

let port = 47821;
try { port = JSON.parse(fs.readFileSync(USER_CONFIG, 'utf8')).port || port; } catch { /* defaults */ }

const remove = process.argv.includes('--uninstall');
try {
  const { file, backup } = hooks.install({ port, remove });
  if (backup) console.log(`• Backup: ${backup}`);
  console.log(remove ? `✓ Pixie hooks removed from ${file}` : `✓ Pixie hooks added to ${file} (port ${port})\n  Restart running Claude Code sessions to load them.`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(1);
}

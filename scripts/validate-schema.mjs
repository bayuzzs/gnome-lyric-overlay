import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { readText, repoPath } from './lib/repo.mjs';

const schemaPath = 'schemas/org.gnome.shell.extensions.lyric-overlay.gschema.xml';
const schema = await readText(schemaPath);
const failures = [];

const requiredKeys = [
  'display-mode',
  'lyrics-visible',
  'fallback-mode',
  'floating-locked',
  'floating-lines',
  'floating-x-ratio',
  'floating-y-ratio',
  'floating-monitor-index',
  'floating-max-width',
  'floating-preserve-width',
  'floating-show-vinyl',
  'floating-show-track-info',
  'floating-show-controls',
  'floating-font-size',
  'floating-bg-opacity',
  'floating-animate',
  'floating-hide-fullscreen',
  'floating-hide-paused',
  'panel-position',
  'panel-index',
  'panel-max-width',
  'text-align',
  'style-text-color-type',
  'style-text-color-custom',
  'style-secondary-opacity',
  'style-text-shadow',
  'lyrics-offset-ms',
  'player-priority',
  'browser-player-service',
  'cache-enabled',
  'debug-logging',
  'shortcut-toggle-mode',
  'shortcut-toggle-lock',
  'shortcut-toggle-visible',
];

if (!schema.includes('id="org.gnome.shell.extensions.lyric-overlay"')) {
  failures.push('Schema id must be org.gnome.shell.extensions.lyric-overlay.');
}

if (!schema.includes('path="/org/gnome/shell/extensions/lyric-overlay/"')) {
  failures.push('Schema path must be /org/gnome/shell/extensions/lyric-overlay/.');
}

for (const key of requiredKeys) {
  if (!schema.includes(`name="${key}"`)) {
    failures.push(`Schema is missing required key: ${key}`);
  }
}

const tmp = await mkdtemp(join(tmpdir(), 'lyric-overlay-schema-'));
try {
  await cp(repoPath('schemas'), tmp, { recursive: true });
  const result = spawnSync('glib-compile-schemas', [tmp], { encoding: 'utf8' });

  if (isNodeError(result.error) && result.error.code === 'ENOENT') {
    failures.push('glib-compile-schemas is required to validate the GSettings schema.');
  } else if (result.status !== 0) {
    failures.push(`glib-compile-schemas failed:\n${result.stderr || result.stdout}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('GSettings schema is valid.\n');

/**
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isNodeError(error) {
  return error instanceof Error;
}

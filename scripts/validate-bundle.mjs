import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { fileExists, repoPath } from './lib/repo.mjs';

const repoMetadata = JSON.parse(await readFile(repoPath('metadata.json'), 'utf8'));
const { uuid } = repoMetadata;

if (typeof uuid !== 'string' || uuid.trim() === '') {
  process.stderr.write('validate-bundle: metadata.json uuid is missing; run validate:metadata.\n');
  process.exit(1);
}

const distRoot = repoPath('dist');
const unpackedMetadataPath = join(distRoot, uuid, 'metadata.json');
const bundlePath = join(distRoot, `${uuid}.zip`);

const failures = [];

if (!(await fileExists(`dist/${uuid}/metadata.json`))) {
  failures.push(`validate-bundle: unpacked metadata not found at dist/${uuid}/metadata.json.`);
}

if (!(await fileExists(`dist/${uuid}.zip`))) {
  failures.push(`validate-bundle: bundle zip not found at dist/${uuid}.zip.`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

const unpackedMetadata = JSON.parse(await readFile(unpackedMetadataPath, 'utf8'));
const unzipResult = spawnSync('unzip', ['-p', bundlePath, 'metadata.json'], { encoding: 'utf8' });

if (isNodeError(unzipResult.error) && unzipResult.error.code === 'ENOENT') {
  process.stderr.write('validate-bundle: unzip is required to inspect the bundle.\n');
  process.exit(1);
}

if (unzipResult.status !== 0) {
  process.stderr.write(unzipResult.stderr || unzipResult.stdout || 'unzip failed.\n');
  process.exit(unzipResult.status ?? 1);
}

const zippedMetadata = JSON.parse(unzipResult.stdout);
compareMetadata('dist/<uuid>/metadata.json', unpackedMetadata, repoMetadata, failures);
compareMetadata('metadata.json inside zip', zippedMetadata, repoMetadata, failures);

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Bundle metadata matches repo metadata (version-name: ${repoMetadata['version-name'] ?? 'unset'}).\n`,
);

/**
 * @param {string} label
 * @param {Record<string, unknown>} candidate
 * @param {Record<string, unknown>} expected
 * @param {string[]} list
 * @returns {void}
 */
function compareMetadata(label, candidate, expected, list) {
  const fields = ['uuid', 'name', 'version-name', 'description', 'url', 'settings-schema'];
  for (const field of fields) {
    if (candidate[field] !== expected[field]) {
      list.push(`validate-bundle: ${label} field "${field}" mismatch.`);
    }
  }

  const candidateVersions = Array.isArray(candidate['shell-version'])
    ? candidate['shell-version']
    : [];
  const expectedVersions = Array.isArray(expected['shell-version'])
    ? expected['shell-version']
    : [];
  if (
    candidateVersions.length !== expectedVersions.length ||
    candidateVersions.some((value, index) => value !== expectedVersions[index])
  ) {
    list.push(`validate-bundle: ${label} shell-version mismatch.`);
  }
}

/**
 * @param {unknown} error
 * @returns {error is NodeJS.ErrnoException}
 */
function isNodeError(error) {
  return error instanceof Error;
}

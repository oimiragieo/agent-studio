#!/usr/bin/env node
/**
 * Format only git-tracked files with Prettier.
 *
 * Why: broad globs (for example `** / *.{js,mjs,json,md,yaml,yml}` without the spaces)
 * can enumerate enormous directory trees and cause Node heap OOM (especially on Windows).
 *
 * Usage:
 *   node scripts/format-tracked.mjs --write
 *   node scripts/format-tracked.mjs --check
 */

import { execFileSync, spawnSync } from 'child_process';
import { extname } from 'path';
import { fileURLToPath } from 'url';

const argv = new Set(process.argv.slice(2));
const mode = argv.has('--check') ? 'check' : 'write';

if (mode !== 'check' && !argv.has('--write')) {
  process.stderr.write('Usage: node scripts/format-tracked.mjs --write|--check\n');
  process.exit(2);
}

const prettierExtensions = new Set(['.js', '.mjs', '.json', '.md', '.yaml', '.yml']);

function isWindows() {
  return process.platform === 'win32';
}

function getTrackedFiles() {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf-8' });
  return out
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function resolvePrettierBin() {
  return fileURLToPath(new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url));
}

function runPrettierChunk(prettierBin, files) {
  const result = spawnSync(
    process.execPath,
    [prettierBin, mode === 'check' ? '--check' : '--write', '--ignore-unknown', ...files],
    { stdio: 'inherit', shell: false }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  const candidates = getTrackedFiles().filter(f => prettierExtensions.has(extname(f)));

  if (candidates.length === 0) {
    process.stdout.write('No tracked files matched for formatting.\n');
    return;
  }

  const prettierBin = resolvePrettierBin();

  // Chunk by approximate command length to avoid platform limits.
  const maxCmdChars = isWindows() ? 30000 : 100000;
  const baseLen = `${process.execPath} ${prettierBin} --write --ignore-unknown`.length;

  let current = [];
  let currentLen = baseLen;

  const flush = () => {
    if (current.length === 0) return;
    runPrettierChunk(prettierBin, current);
    current = [];
    currentLen = baseLen;
  };

  for (const file of candidates) {
    const added = file.length + 3;
    if (current.length > 0 && currentLen + added > maxCmdChars) flush();
    current.push(file);
    currentLen += added;
  }
  flush();
}

main().catch(err => {
  process.stderr.write(`${err?.message || err}\n`);
  process.exit(1);
});

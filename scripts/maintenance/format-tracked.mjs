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
 *   node scripts/format-tracked.mjs --write --quiet
 */

import { execFileSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { extname } from 'path';
import { fileURLToPath } from 'url';

const argv = new Set(process.argv.slice(2));
const mode = argv.has('--check') ? 'check' : 'write';
const quiet = argv.has('--quiet');

if (mode !== 'check' && !argv.has('--write')) {
  process.stderr.write('Usage: node scripts/format-tracked.mjs --write|--check [--quiet]\n');
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

function getDeletedTrackedFiles() {
  const collect = args => {
    try {
      const out = execFileSync('git', args, { encoding: 'utf-8' });
      return out
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  // Include both staged and unstaged deletions so format works during refactors/cleanup.
  const staged = collect(['diff', '--cached', '--name-only', '--diff-filter=D']);
  const unstaged = collect(['diff', '--name-only', '--diff-filter=D']);
  return new Set([...staged, ...unstaged]);
}

function resolvePrettierBin() {
  return fileURLToPath(new URL('../../node_modules/prettier/bin/prettier.cjs', import.meta.url));
}

function runPrettierChunk(prettierBin, files) {
  const requestedLogLevel = String(process.env.FORMAT_LOG_LEVEL || '').trim();
  const logLevel = requestedLogLevel || (mode === 'check' || quiet ? 'warn' : '');

  const args = [
    prettierBin,
    mode === 'check' ? '--check' : '--write',
    '--ignore-unknown',
    ...files,
  ];

  // In write mode, default to Prettier's normal output (helps users see that formatting ran).
  // Use `--quiet` or FORMAT_LOG_LEVEL=warn to suppress per-file logs.
  if (logLevel) {
    args.splice(3, 0, '--log-level', logLevel);
  }

  const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function main() {
  const candidates = getTrackedFiles().filter(f => prettierExtensions.has(extname(f)));

  if (candidates.length === 0) {
    process.stdout.write('No tracked files matched for formatting.\n');
    return;
  }

  if (!quiet) {
    process.stdout.write(`Formatting ${candidates.length} tracked file(s) (${mode})...\n`);
  }

  const existingCandidates = [];
  const missingPaths = [];
  const deletedTracked = getDeletedTrackedFiles();

  for (const file of candidates) {
    if (existsSync(file)) existingCandidates.push(file);
    else missingPaths.push(file);
  }

  if (missingPaths.length > 0) {
    const optionalRoots = ['.opencode', '.factory'];
    const isOptionalMissing = p =>
      optionalRoots.some(
        root => p === root || p.startsWith(`${root}/`) || p.startsWith(`${root}\\`)
      );

    const optionalMissing = missingPaths.filter(p => isOptionalMissing(p));
    const nonOptionalMissing = missingPaths.filter(p => !isOptionalMissing(p));
    const unexpectedMissing = nonOptionalMissing.filter(p => !deletedTracked.has(p));

    if (unexpectedMissing.length > 0) {
      process.stderr.write(
        `Found ${unexpectedMissing.length} tracked path(s) missing on disk outside optional dirs (${optionalRoots.join(
          ', '
        )}).\n`
      );
      process.stderr.write(
        `First missing path(s):\n${unexpectedMissing
          .slice(0, 10)
          .map(p => `- ${p}`)
          .join('\n')}\n`
      );
      process.stderr.write(
        `If this is expected, restore the files or update the formatter to treat them as optional.\n`
      );
      process.exit(2);
    }

    const expectedDeletedCount = nonOptionalMissing.length - unexpectedMissing.length;
    if (expectedDeletedCount > 0 && !quiet) {
      process.stderr.write(
        `Skipping ${expectedDeletedCount} tracked path(s) missing on disk because they are staged/marked for deletion.\n`
      );
    }

    if (optionalMissing.length > 0) {
      process.stderr.write(
        `Skipping ${optionalMissing.length} tracked optional path(s) missing on disk (${optionalRoots.join(
          ', '
        )}).\n`
      );
    }
  }

  const filesToFormat = existingCandidates;
  if (filesToFormat.length === 0) {
    process.stdout.write('No existing tracked files matched for formatting.\n');
    return;
  }
  const prettierBin = resolvePrettierBin();

  // Chunk by approximate command length to avoid platform limits.
  const maxCmdChars = isWindows() ? 30000 : 100000;
  const baseLen = `${process.execPath} ${prettierBin} --write --ignore-unknown`.length;

  let current = [];
  let currentLen = baseLen;
  let chunks = 0;

  const flush = () => {
    if (current.length === 0) return;
    runPrettierChunk(prettierBin, current);
    chunks += 1;
    current = [];
    currentLen = baseLen;
  };

  for (const file of filesToFormat) {
    const added = file.length + 3;
    if (current.length > 0 && currentLen + added > maxCmdChars) flush();
    current.push(file);
    currentLen += added;
  }
  flush();

  if (!quiet) {
    const verb = mode === 'check' ? 'Checked' : 'Formatted';
    process.stdout.write(`${verb} ${filesToFormat.length} file(s) in ${chunks} chunk(s).\n`);
  }
}

main().catch(err => {
  process.stderr.write(`${err?.message || err}\n`);
  process.exit(1);
});

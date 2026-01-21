#!/usr/bin/env node
/**
 * Project Selector (runtime namespace)
 *
 * Agent Zero–inspired: switch "active project" within this repo so runtime artifacts
 * (runs/jobs/last-run) are isolated per project.
 *
 * Usage:
 *   node .claude/tools/project.mjs current
 *   node .claude/tools/project.mjs use <name>
 *   node .claude/tools/project.mjs clear
 *
 * Notes:
 * - Writes `.claude/context/runtime/active-project.json` (in the base runtime dir).
 * - Does NOT affect Claude Code's own global `~/.claude/projects/` store.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveRuntimeScope } from './runtime-scope.mjs';

function usage() {
  process.stdout.write(
    [
      'project',
      '',
      'Usage:',
      '  node .claude/tools/project.mjs current',
      '  node .claude/tools/project.mjs use <name>',
      '  node .claude/tools/project.mjs clear',
      '',
    ].join('\n')
  );
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf8');
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === '--help' || cmd === '-h') {
    usage();
    process.exitCode = cmd ? 0 : 1;
    return;
  }

  const scope = resolveRuntimeScope();
  const activePath = join(scope.baseRuntimeDir, 'active-project.json');

  if (cmd === 'current') {
    process.stdout.write(
      JSON.stringify(
        {
          active_project: scope.activeProject,
          base_runtime_dir: scope.baseRuntimeDir,
          runtime_dir: scope.runtimeDir,
        },
        null,
        2
      )
    );
    return;
  }

  if (cmd === 'clear') {
    writeJson(activePath, { name: '', cleared_at: new Date().toISOString() });
    process.stdout.write(
      JSON.stringify({ ok: true, active_project: null, runtime_dir: scope.baseRuntimeDir }, null, 2)
    );
    return;
  }

  if (cmd === 'use') {
    const name = String(rest.join(' ')).trim();
    if (!name) {
      process.stderr.write('Missing project name.\n');
      process.exitCode = 1;
      return;
    }
    writeJson(activePath, { name, set_at: new Date().toISOString() });
    const next = resolveRuntimeScope();
    process.stdout.write(
      JSON.stringify(
        { ok: true, active_project: next.activeProject, runtime_dir: next.runtimeDir },
        null,
        2
      )
    );
    return;
  }

  usage();
  process.exitCode = 1;
}

main();

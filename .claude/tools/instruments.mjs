#!/usr/bin/env node
/**
 * Instruments (Agent Zero–style)
 *
 * Instruments are on-disk, discoverable helpers that keep the main prompt lean.
 * They’re like “skills”, but implemented as executable commands/config.
 *
 * Layout:
 *   .claude/instruments/default/<name>/instrument.json
 *   .claude/instruments/custom/<name>/instrument.json
 *
 * instrument.json:
 *   {
 *     "name": "system-diagnostics",
 *     "description": "Run repo diagnostics",
 *     "command": "node .claude/tools/system-diagnostics.mjs",
 *     "timeout_ms": 3600000
 *   }
 *
 * Usage:
 *   node .claude/tools/instruments.mjs list
 *   node .claude/tools/instruments.mjs run <name> [-- <args...>]
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const DEFAULT_DIR = join(PROJECT_ROOT, '.claude', 'instruments', 'default');
const CUSTOM_DIR = join(PROJECT_ROOT, '.claude', 'instruments', 'custom');

function usage() {
  process.stdout.write(
    [
      'instruments',
      '',
      'Usage:',
      '  node .claude/tools/instruments.mjs list [--json]',
      '  node .claude/tools/instruments.mjs run <name> [-- <args...>]',
      '',
    ].join('\n')
  );
}

function safeJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readInstrumentDir(dirPath, scope) {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath, { withFileTypes: true }).filter(e => e.isDirectory());
  const instruments = [];
  for (const entry of entries) {
    const folder = join(dirPath, entry.name);
    const cfgPath = join(folder, 'instrument.json');
    const cfg = safeJson(cfgPath);
    if (!cfg || typeof cfg !== 'object') continue;
    const name = typeof cfg.name === 'string' ? cfg.name.trim() : entry.name;
    if (!name) continue;
    instruments.push({
      name,
      description: typeof cfg.description === 'string' ? cfg.description.trim() : '',
      command: typeof cfg.command === 'string' ? cfg.command.trim() : '',
      timeout_ms: Number.isFinite(Number(cfg.timeout_ms)) ? Number(cfg.timeout_ms) : null,
      scope,
      path: folder,
      config_path: cfgPath,
    });
  }
  return instruments;
}

function loadAll() {
  const all = [
    ...readInstrumentDir(DEFAULT_DIR, 'default'),
    ...readInstrumentDir(CUSTOM_DIR, 'custom'),
  ];
  const byName = new Map();
  for (const inst of all) {
    // custom overrides default if same name
    if (!byName.has(inst.name) || inst.scope === 'custom') byName.set(inst.name, inst);
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function platformShell(commandString) {
  if (process.platform === 'win32')
    return { cmd: 'cmd.exe', args: ['/d', '/s', '/c', commandString] };
  return { cmd: 'bash', args: ['-lc', commandString] };
}

async function runCommand(commandString, timeoutMs) {
  const shell = platformShell(commandString);
  return await new Promise(resolve => {
    const startedAt = Date.now();
    const child = spawn(shell.cmd, shell.args, {
      cwd: PROJECT_ROOT,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', c => (stdout += c.toString('utf8')));
    child.stderr.on('data', c => (stderr += c.toString('utf8')));

    const t = setTimeout(
      () => {
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
      },
      Math.max(1000, timeoutMs || 0)
    );

    child.on('close', code => {
      clearTimeout(t);
      resolve({ code, stdout, stderr, duration_ms: Date.now() - startedAt });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || '';
  const json = args.includes('--json');
  const dashDash = args.indexOf('--');
  const trailing = dashDash >= 0 ? args.slice(dashDash + 1) : [];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    usage();
    process.exitCode = cmd ? 0 : 1;
    return;
  }

  const instruments = loadAll();

  if (cmd === 'list') {
    const payload = { count: instruments.length, instruments };
    if (json) process.stdout.write(JSON.stringify(payload, null, 2));
    else {
      process.stdout.write(`INSTRUMENTS (${instruments.length})\n`);
      for (const i of instruments)
        process.stdout.write(
          `- ${i.name} (${i.scope})${i.description ? `: ${i.description}` : ''}\n`
        );
    }
    return;
  }

  if (cmd === 'run') {
    const name = String(args[1] || '').trim();
    if (!name) {
      process.stderr.write('Missing instrument name.\n');
      process.exitCode = 1;
      return;
    }
    const inst = instruments.find(i => i.name === name);
    if (!inst) {
      process.stderr.write(`Unknown instrument: ${name}\n`);
      process.exitCode = 1;
      return;
    }
    if (!inst.command) {
      process.stderr.write(`Instrument ${name} has no command.\n`);
      process.exitCode = 1;
      return;
    }
    const cmdString = trailing.length ? `${inst.command} ${trailing.join(' ')}` : inst.command;
    const res = await runCommand(cmdString, inst.timeout_ms || 0);
    process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    process.exitCode = res.code ?? 1;
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch(err => {
  process.stderr.write(String(err?.message || err) + '\n');
  process.exit(1);
});

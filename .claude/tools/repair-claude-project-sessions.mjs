#!/usr/bin/env node
/**
 * Repair Claude Code Project Sessions
 *
 * Fixes noisy startup errors like:
 *   Error opening file ...\.claude\projects\<project>\ <sessionId>.jsonl: ENOENT
 *
 * Root cause: Claude Code's history/index may reference sessionId.jsonl files
 * that were deleted or never written (common after manual cleanup or partial
 * migrations). Claude Code then tries to open them during stats/cache refresh.
 *
 * This tool can create empty placeholder `.jsonl` files for those missing
 * sessions so the CLI stops logging ENOENT.
 *
 * Defaults to dry-run (prints what would be created).
 *
 * Usage:
 *   node .claude/tools/repair-claude-project-sessions.mjs
 *   node .claude/tools/repair-claude-project-sessions.mjs --create
 *   node .claude/tools/repair-claude-project-sessions.mjs --project "C:\\dev\\projects\\omega-main" --create
 */

import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

function parseArgs(argv) {
  const args = argv.slice(2);
  const hasFlag = name => args.includes(`--${name}`);
  const getArg = name => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : null;
  };

  return {
    create: hasFlag('create'),
    allProjects: hasFlag('all-projects') || hasFlag('all'),
    project: getArg('project'),
    home: getArg('home'),
    history: getArg('history'),
    help: hasFlag('help') || hasFlag('h'),
    json: hasFlag('json'),
  };
}

function projectPathToProjectDirName(projectPath) {
  const raw = String(projectPath || '').trim();
  if (!raw) return null;
  // Matches observed Claude Code layout: "C:\dev\projects\omega-main" -> "C--dev-projects-omega-main"
  return raw.replace(/:/g, '-').replace(/[\\/]+/g, '-');
}

function safeFileId(input) {
  const raw = String(input ?? '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
  return `${cleaned || 'session'}-${hash}`;
}

async function readHistoryEntries(historyPath) {
  if (!existsSync(historyPath)) return [];
  const content = await readFile(historyPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(Boolean);

  const entries = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      entries.push(parsed);
    } catch {
      // ignore malformed lines
    }
  }
  return entries;
}

function toCandidateSessionIds(entries) {
  const ids = new Set();
  for (const entry of entries) {
    const id = entry?.sessionId ?? entry?.session_id ?? null;
    if (typeof id === 'string' && id.trim()) ids.add(id.trim());
  }
  return Array.from(ids);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(`
Repair Claude Code Project Sessions

Usage:
  node .claude/tools/repair-claude-project-sessions.mjs [options]

Options:
  --create            Create missing session .jsonl placeholders (default: dry-run)
  --project <path>    Repair only this project path (e.g. "C:\\\\dev\\\\projects\\\\LLM-RULES")
  --all-projects      Repair all projects referenced in Claude history (default: only current working directory)
  --home <dir>        Override Claude home dir (default: %USERPROFILE%/.claude)
  --history <path>    Override history.jsonl path (default: <home>/history.jsonl)
  --json              Output machine-readable JSON summary
  --help, --h         Show this help
`);
    process.exit(0);
  }

  const claudeHome = opts.home ? path.resolve(opts.home) : path.join(os.homedir(), '.claude');
  const historyPath = opts.history
    ? path.resolve(opts.history)
    : path.join(claudeHome, 'history.jsonl');
  const projectsRoot = path.join(claudeHome, 'projects');

  const targetProject = opts.allProjects
    ? null
    : path.resolve(opts.project ? opts.project : process.cwd());

  const entries = await readHistoryEntries(historyPath);
  const byProject = new Map();
  for (const entry of entries) {
    const project = entry?.project ?? null;
    if (typeof project !== 'string' || !project.trim()) continue;
    if (targetProject && path.resolve(project.trim()).toLowerCase() !== targetProject.toLowerCase())
      continue;
    if (!byProject.has(project.trim())) byProject.set(project.trim(), []);
    byProject.get(project.trim()).push(entry);
  }

  const repairs = [];
  for (const [projectPath, projectEntries] of byProject.entries()) {
    const projectDirName = projectPathToProjectDirName(projectPath);
    if (!projectDirName) continue;
    const projectDir = path.join(projectsRoot, projectDirName);
    const sessionIds = toCandidateSessionIds(projectEntries);

    for (const sessionId of sessionIds) {
      const candidate = path.join(projectDir, `${sessionId}.jsonl`);
      if (existsSync(candidate)) continue;
      repairs.push({
        project: projectPath,
        project_dir: projectDir,
        session_id: sessionId,
        missing_path: candidate,
      });
    }
  }

  if (!opts.create) {
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            mode: 'dry-run',
            target_project: targetProject,
            all_projects: Boolean(opts.allProjects),
            matched_projects: Array.from(byProject.keys()),
            missing: repairs,
          },
          null,
          2
        )
      );
    } else {
      if (!opts.allProjects) {
        console.log(`Target project: ${targetProject}`);
        if (byProject.size === 0) {
          console.log(
            'Note: No history entries matched this project. Use `--all-projects` or `--project <path>`.'
          );
        }
        console.log('');
      }
      console.log(`Missing session files: ${repairs.length}`);
      for (const r of repairs.slice(0, 50)) {
        console.log(`- ${r.missing_path}`);
      }
      if (repairs.length > 50) console.log(`- ... and ${repairs.length - 50} more`);
      if (repairs.length > 0) console.log('\nRe-run with `--create` to create empty placeholders.');
    }
    process.exit(0);
  }

  // Create placeholders
  const created = [];
  const failed = [];
  for (const r of repairs) {
    try {
      await mkdir(path.dirname(r.missing_path), { recursive: true });
      // Empty JSONL file is acceptable: no lines => no messages to load, but file exists.
      await writeFile(r.missing_path, '', 'utf-8');
      created.push(r);
    } catch (error) {
      failed.push({ ...r, error: String(error?.message || error) });
    }
  }

  const result = {
    mode: 'create',
    target_project: targetProject,
    all_projects: Boolean(opts.allProjects),
    matched_projects: Array.from(byProject.keys()),
    created_count: created.length,
    failed_count: failed.length,
    created,
    failed,
  };
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Created: ${created.length}`);
    if (failed.length) {
      console.log(`Failed: ${failed.length}`);
      for (const f of failed.slice(0, 10)) console.log(`- ${f.missing_path}: ${f.error}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err?.message || err);
  process.exit(1);
});

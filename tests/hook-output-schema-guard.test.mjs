import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadSettingsJson() {
  const path = join(process.cwd(), '.claude', 'settings.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function extractHookScriptsByEvent(settings) {
  /** @type {Map<string, Set<string>>} */
  const byEvent = new Map();
  const hookGroups = settings?.hooks ?? {};
  for (const [eventName, matchers] of Object.entries(hookGroups)) {
    if (!Array.isArray(matchers)) continue;
    for (const matcher of matchers) {
      const hooks = matcher?.hooks;
      if (!Array.isArray(hooks)) continue;
      for (const h of hooks) {
        if (h?.type !== 'command') continue;
        const cmd = String(h?.command || '').trim();
        // Expect: node .claude/hooks/<script>.mjs [args...]
        const m = cmd.match(/^node\s+([^\s]+\.m?js)\b/i);
        if (!m) continue;
        const scriptPath = m[1];
        if (!scriptPath.startsWith('.claude/hooks/')) continue;
        const abs = join(process.cwd(), scriptPath);
        if (!byEvent.has(eventName)) byEvent.set(eventName, new Set());
        byEvent.get(eventName).add(abs);
      }
    }
  }

  /** @type {{ event: string, scripts: string[] }[]} */
  const out = [];
  for (const [event, scripts] of byEvent.entries()) {
    out.push({ event, scripts: [...scripts] });
  }
  return out;
}

function hasValidApproveDecision(source) {
  return /decision\s*:\s*['"]approve['"]|"decision"\s*:\s*"approve"/.test(source);
}

function hasHookSpecificOutputMarker(source) {
  return /hookSpecificOutput/.test(source);
}

describe('hook output schema guard', () => {
  it('ensures hooks wired in .claude/settings.json use decision:"approve" instead of legacy "allow"', () => {
    const settings = loadSettingsJson();
    const byEvent = extractHookScriptsByEvent(settings);
    const scripts = byEvent.flatMap(e => e.scripts);
    assert.ok(
      scripts.length > 0,
      'expected to find at least one hook script referenced in .claude/settings.json'
    );

    const missingApprove = [];
    const containsLegacyAllow = [];

    // Always forbid decision:"allow" across all hooks.
    for (const script of scripts) {
      const src = readFileSync(script, 'utf8');
      if (/decision\s*:\s*['"]allow['"]|"decision"\s*:\s*"allow"/.test(src)) {
        containsLegacyAllow.push(script);
      }
    }

    // PreToolUse hooks must emit a decision; other events can use hookSpecificOutput.
    for (const group of byEvent) {
      const { event, scripts: groupScripts } = group;
      for (const script of groupScripts) {
        const src = readFileSync(script, 'utf8');
        if (event === 'PreToolUse') {
          if (!hasValidApproveDecision(src)) missingApprove.push(script);
        } else {
          if (!hasValidApproveDecision(src) && !hasHookSpecificOutputMarker(src))
            missingApprove.push(script);
        }
      }
    }

    assert.deepEqual(
      containsLegacyAllow,
      [],
      `These hook scripts contain legacy decision:"allow" which must be replaced with "approve":\n- ${containsLegacyAllow.join('\n- ')}`
    );

    assert.deepEqual(
      [...new Set(missingApprove)],
      [],
      `These hook scripts do not return a valid decision:"approve" string:\n- ${missingApprove.join('\n- ')}`
    );
  });
});

#!/usr/bin/env node
/**
 * Analyze a Claude Code debug log and print a concise health summary.
 *
 * Usage:
 *   node scripts/analyze-claude-debug.mjs "C:\\Users\\you\\.claude\\debug\\<session>.txt"
 *   node scripts/analyze-claude-debug.mjs --json <path>
 */

import { readFileSync } from 'fs';

function parseArgs(argv) {
  const args = { json: false, path: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--json') args.json = true;
    else if (!args.path) args.path = arg;
  }
  return args;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isKnownNonError(line) {
  // Some Claude Code debug logs mark MCP server stderr as [ERROR] even when it's an
  // informational startup banner. Treat these as noise so diagnostics don't false-alarm.
  const mcpStderr = line.match(/MCP server \"([^\"]+)\" Server stderr:\s*(.*)$/i);
  if (mcpStderr?.[2]) {
    const msg = String(mcpStderr[2] || '')
      .trim()
      .toLowerCase();
    if (msg.includes('mcp server running on stdio') || msg.includes('running on stdio'))
      return true;
  }
  return false;
}

function main() {
  const { json, path } = parseArgs(process.argv);
  if (!path) {
    console.error('Usage: node scripts/analyze-claude-debug.mjs [--json] <debug-log-path>');
    process.exit(2);
  }

  const raw = readFileSync(path, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);

  const out = {
    path,
    totals: { lines: lines.length, warn: 0, error: 0 },
    streaming: { stalls: [], stallCount: 0 },
    toolSearch: {
      disabledForModel: {},
      mcpSearchToolMissingCount: 0,
      autoDisabledCount: 0,
    },
    mcp: { stderrByServer: {}, stderrNoiseCount: 0 },
    npm: { viewFailures: 0 },
    reads: { maxFileReadTokenExceededCount: 0 },
    routing: { blockCount: 0, sampleBlockReasons: [] },
  };

  for (const line of lines) {
    if (line.includes('[WARN]')) out.totals.warn += 1;
    if (line.includes('[ERROR]')) {
      if (isKnownNonError(line)) out.mcp.stderrNoiseCount += 1;
      else out.totals.error += 1;
    }

    const stall = line.match(/Streaming stall detected:\s*([0-9.]+)s\b/i);
    if (stall?.[1]) {
      const seconds = Number(stall[1]);
      if (Number.isFinite(seconds)) out.streaming.stalls.push(seconds);
    }

    const modelDisabled = line.match(/Tool search disabled for model '([^']+)'/i);
    if (modelDisabled?.[1]) {
      const model = modelDisabled[1];
      out.toolSearch.disabledForModel[model] = (out.toolSearch.disabledForModel[model] || 0) + 1;
    }

    if (line.includes('Tool search disabled: MCPSearchTool is not available')) {
      out.toolSearch.mcpSearchToolMissingCount += 1;
    }
    if (line.includes('Auto tool search disabled:')) {
      out.toolSearch.autoDisabledCount += 1;
    }

    if (line.includes('npm view failed with code')) {
      out.npm.viewFailures += 1;
    }

    if (line.includes('MaxFileReadTokenExceededError')) {
      out.reads.maxFileReadTokenExceededCount += 1;
    }

    const mcpStderr = line.match(/MCP server \"([^\"]+)\" Server stderr:\s*(.*)$/i);
    if (mcpStderr?.[1]) {
      const server = mcpStderr[1];
      const msg = (mcpStderr[2] || '').trim();
      out.mcp.stderrByServer[server] = out.mcp.stderrByServer[server] || [];
      if (msg) out.mcp.stderrByServer[server].push(msg);
    }

    if (line.includes('"decision":"block"')) {
      out.routing.blockCount += 1;
      if (out.routing.sampleBlockReasons.length < 3) {
        const jsonStart = line.indexOf('{');
        if (jsonStart >= 0) {
          const obj = safeJsonParse(line.slice(jsonStart));
          if (obj?.reason && typeof obj.reason === 'string')
            out.routing.sampleBlockReasons.push(obj.reason);
        }
      }
    }
  }

  out.streaming.stallCount = out.streaming.stalls.length;

  const derived = {
    maxStallSeconds: out.streaming.stalls.length ? Math.max(...out.streaming.stalls) : 0,
    avgStallSeconds: out.streaming.stalls.length
      ? out.streaming.stalls.reduce((a, b) => a + b, 0) / out.streaming.stalls.length
      : 0,
    mcpServersWithStderr: Object.keys(out.mcp.stderrByServer).length,
  };

  if (json) {
    process.stdout.write(JSON.stringify({ ...out, derived }, null, 2));
    return;
  }

  const models = Object.entries(out.toolSearch.disabledForModel)
    .sort((a, b) => b[1] - a[1])
    .map(([m, n]) => `${m} (${n})`);

  console.log(`Debug log: ${path}`);
  console.log(`Lines: ${out.totals.lines} | WARN: ${out.totals.warn} | ERROR: ${out.totals.error}`);
  if (out.streaming.stallCount) {
    console.log(
      `Streaming stalls: ${out.streaming.stallCount} (max ${derived.maxStallSeconds.toFixed(1)}s, avg ${derived.avgStallSeconds.toFixed(1)}s)`
    );
  } else {
    console.log('Streaming stalls: none');
  }

  if (models.length || out.toolSearch.mcpSearchToolMissingCount) {
    console.log(
      `Tool Search disabled events: models=${models.length ? models.join(', ') : 'none'} | MCPSearchTool missing=${out.toolSearch.mcpSearchToolMissingCount}`
    );
  }

  if (derived.mcpServersWithStderr) {
    const servers = Object.keys(out.mcp.stderrByServer).join(', ');
    console.log(`MCP stderr observed for: ${servers}`);
    if (out.mcp.stderrNoiseCount) {
      console.log(`MCP stderr noise lines: ${out.mcp.stderrNoiseCount} (e.g., "running on stdio")`);
    }
  }

  if (out.routing.blockCount) {
    console.log(`Routing blocks: ${out.routing.blockCount}`);
    if (out.routing.sampleBlockReasons.length) {
      console.log('Sample block reason (first):');
      console.log(out.routing.sampleBlockReasons[0]);
    }
  }

  if (out.reads.maxFileReadTokenExceededCount) {
    console.log(
      `Read token cap errors: ${out.reads.maxFileReadTokenExceededCount} (MaxFileReadTokenExceededError)`
    );
  }

  if (out.npm.viewFailures) {
    console.log(`npm view failures: ${out.npm.viewFailures} (often network/proxy/offline)`);
  }

  console.log('\nSuggested follow-ups:');
  console.log(
    '- If you want Tool Search: use a Sonnet/Opus model for the active agent (Haiku disables tool_reference blocks).'
  );
  console.log(
    '- If you see MCPSearchTool missing: confirm Claude Code settings do not disallow MCPSearchTool.'
  );
  console.log(
    '- If routing blocks are unexpected: check router handoff_target state under `.claude/context/tmp/routing-sessions/`.'
  );
  console.log(
    '- If Read token cap errors occur: use `Grep` or Read with `offset`/`limit` (and keep large reads paged).'
  );
  console.log(
    '- If you see streaming stalls: prefer durable jobs for long commands and avoid oversized tool outputs.'
  );
}

main();

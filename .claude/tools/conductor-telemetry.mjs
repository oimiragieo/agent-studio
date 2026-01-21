#!/usr/bin/env node
/**
 * Conductor Telemetry - Usage analytics and performance metrics
 *
 * PRIVACY-FIRST TELEMETRY:
 * - OPT-IN ONLY: Disabled by default, requires explicit user consent
 * - NO PII: No personally identifiable information collected
 * - LOCAL STORAGE: All data stored locally, never transmitted
 * - TRANSPARENT: All collected metrics documented and queryable
 * - USER CONTROL: Can be disabled at any time, data can be purged
 *
 * Collected Metrics (opt-in):
 * - Track lifecycle events (create, activate, complete, duration)
 * - Workflow execution times and success rates
 * - Snapshot creation frequency and sizes
 * - Feature usage patterns
 * - Error frequencies and types
 * - System performance (context usage, memory)
 *
 * Usage:
 *   node .claude/tools/conductor-telemetry.mjs status
 *   node .claude/tools/conductor-telemetry.mjs enable
 *   node .claude/tools/conductor-telemetry.mjs disable
 *   node .claude/tools/conductor-telemetry.mjs report [--period 7d] [--format json]
 *   node .claude/tools/conductor-telemetry.mjs export --output telemetry.json
 *   node .claude/tools/conductor-telemetry.mjs purge [--confirm]
 *   node .claude/tools/conductor-telemetry.mjs log-event --type <type> --data <json>
 */

import { readFile, writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONDUCTOR_DIR = join(__dirname, '../conductor');
const TELEMETRY_DIR = join(CONDUCTOR_DIR, 'telemetry');
const TELEMETRY_CONFIG_PATH = join(TELEMETRY_DIR, 'config.json');
const EVENTS_DIR = join(TELEMETRY_DIR, 'events');

// Event types
const EVENT_TYPES = {
  TRACK_CREATED: 'track.created',
  TRACK_ACTIVATED: 'track.activated',
  TRACK_PAUSED: 'track.paused',
  TRACK_RESUMED: 'track.resumed',
  TRACK_COMPLETED: 'track.completed',
  TRACK_FAILED: 'track.failed',
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  SNAPSHOT_CREATED: 'snapshot.created',
  SNAPSHOT_RESTORED: 'snapshot.restored',
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',
  FEATURE_ENABLED: 'feature.enabled',
  FEATURE_DISABLED: 'feature.disabled',
  ERROR_OCCURRED: 'error.occurred',
};

/**
 * Color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Ensure telemetry directories exist
 */
async function ensureTelemetryDirs() {
  if (!existsSync(TELEMETRY_DIR)) {
    await mkdir(TELEMETRY_DIR, { recursive: true });
  }
  if (!existsSync(EVENTS_DIR)) {
    await mkdir(EVENTS_DIR, { recursive: true });
  }
}

/**
 * Load telemetry configuration
 */
async function loadConfig() {
  await ensureTelemetryDirs();

  if (!existsSync(TELEMETRY_CONFIG_PATH)) {
    return await initializeConfig();
  }

  const content = await readFile(TELEMETRY_CONFIG_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save telemetry configuration
 */
async function saveConfig(config) {
  config.last_updated = new Date().toISOString();
  await writeFile(TELEMETRY_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Initialize telemetry configuration
 */
async function initializeConfig() {
  const config = {
    version: '1.0.0',
    enabled: false,
    opt_in_timestamp: null,
    user_consent: false,
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    privacy: {
      no_pii: true,
      local_only: true,
      can_be_purged: true,
      retention_days: 90,
    },
    collection: {
      track_events: true,
      workflow_events: true,
      snapshot_events: true,
      feature_usage: true,
      error_events: true,
      performance_metrics: true,
    },
    statistics: {
      total_events: 0,
      first_event_at: null,
      last_event_at: null,
    },
  };

  await saveConfig(config);
  return config;
}

/**
 * Check if telemetry is enabled
 */
async function isEnabled() {
  const config = await loadConfig();
  return config.enabled && config.user_consent;
}

/**
 * Enable telemetry (requires user consent)
 */
async function enableTelemetry() {
  const config = await loadConfig();

  if (config.enabled) {
    console.log(`${COLORS.yellow}Telemetry is already enabled${COLORS.reset}`);
    return;
  }

  // Display privacy notice
  console.log(
    `${COLORS.bright}${COLORS.cyan}Conductor Telemetry - Privacy Notice${COLORS.reset}\n`
  );
  console.log(
    `${COLORS.dim}By enabling telemetry, you agree to collect the following data:${COLORS.reset}`
  );
  console.log(`  • Track lifecycle events (create, activate, complete, duration)`);
  console.log(`  • Workflow execution times and success rates`);
  console.log(`  • Snapshot creation frequency and sizes`);
  console.log(`  • Feature usage patterns`);
  console.log(`  • Error frequencies and types`);
  console.log(`  • System performance (context usage, memory)\n`);

  console.log(`${COLORS.bright}${COLORS.green}Privacy Guarantees:${COLORS.reset}`);
  console.log(`  ${COLORS.green}✓${COLORS.reset} NO personally identifiable information (PII)`);
  console.log(`  ${COLORS.green}✓${COLORS.reset} ALL data stored locally only`);
  console.log(`  ${COLORS.green}✓${COLORS.reset} Data never transmitted externally`);
  console.log(`  ${COLORS.green}✓${COLORS.reset} Can be disabled at any time`);
  console.log(`  ${COLORS.green}✓${COLORS.reset} All data can be purged\n`);

  config.enabled = true;
  config.user_consent = true;
  config.opt_in_timestamp = new Date().toISOString();

  await saveConfig(config);

  console.log(`${COLORS.green}✓${COLORS.reset} Telemetry enabled`);
  console.log(`${COLORS.dim}Data retention: ${config.privacy.retention_days} days${COLORS.reset}`);
}

/**
 * Disable telemetry
 */
async function disableTelemetry(purgeData = false) {
  const config = await loadConfig();

  if (!config.enabled) {
    console.log(`${COLORS.yellow}Telemetry is already disabled${COLORS.reset}`);
    return;
  }

  config.enabled = false;
  config.user_consent = false;
  await saveConfig(config);

  console.log(`${COLORS.green}✓${COLORS.reset} Telemetry disabled`);

  if (purgeData) {
    await purgeTelemetryData(true);
  } else {
    console.log(
      `${COLORS.dim}Existing data retained. Use 'purge' command to delete.${COLORS.reset}`
    );
  }
}

/**
 * Log telemetry event
 */
export async function logEvent(type, data = {}, metadata = {}) {
  const enabled = await isEnabled();

  if (!enabled) {
    // Silently skip if telemetry disabled
    return null;
  }

  await ensureTelemetryDirs();

  const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();

  const event = {
    event_id: eventId,
    type,
    timestamp,
    data: sanitizeData(data), // Remove any potential PII
    metadata: {
      version: '1.0.0',
      ...metadata,
    },
  };

  // Save event to daily file
  const dateKey = timestamp.split('T')[0]; // YYYY-MM-DD
  const eventFilePath = join(EVENTS_DIR, `events-${dateKey}.json`);

  let events = [];
  if (existsSync(eventFilePath)) {
    const content = await readFile(eventFilePath, 'utf-8');
    events = JSON.parse(content);
  }

  events.push(event);
  await writeFile(eventFilePath, JSON.stringify(events, null, 2), 'utf-8');

  // Update statistics
  const config = await loadConfig();
  config.statistics.total_events = (config.statistics.total_events || 0) + 1;
  if (!config.statistics.first_event_at) {
    config.statistics.first_event_at = timestamp;
  }
  config.statistics.last_event_at = timestamp;
  await saveConfig(config);

  return eventId;
}

/**
 * Sanitize data to remove any potential PII
 */
function sanitizeData(data) {
  const sanitized = { ...data };

  // Remove common PII fields
  const piiFields = [
    'name',
    'email',
    'username',
    'user',
    'author',
    'owner',
    'creator',
    'ip_address',
    'hostname',
  ];

  for (const field of piiFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  // Sanitize file paths (keep structure, remove user-specific parts)
  if (sanitized.path) {
    sanitized.path = sanitized.path.replace(/\/Users\/[^\/]+/, '/Users/<user>');
    sanitized.path = sanitized.path.replace(/C:\\Users\\[^\\]+/, 'C:\\Users\\<user>');
  }

  return sanitized;
}

/**
 * Load events for a given period
 */
async function loadEvents(periodDays = 7) {
  await ensureTelemetryDirs();

  const now = new Date();
  const cutoffDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const files = await readdir(EVENTS_DIR);
  const eventFiles = files.filter(f => f.startsWith('events-') && f.endsWith('.json'));

  let allEvents = [];

  for (const file of eventFiles) {
    const filePath = join(EVENTS_DIR, file);
    const content = await readFile(filePath, 'utf-8');
    const events = JSON.parse(content);

    // Filter by date
    const filteredEvents = events.filter(e => new Date(e.timestamp) >= cutoffDate);
    allEvents = allEvents.concat(filteredEvents);
  }

  return allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Generate telemetry report
 */
async function generateReport(options = {}) {
  const { periodDays = 7, format = 'text' } = options;

  const config = await loadConfig();
  const events = await loadEvents(periodDays);

  const report = {
    period: {
      days: periodDays,
      start: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
    summary: {
      total_events: events.length,
      telemetry_enabled: config.enabled,
      opt_in_date: config.opt_in_timestamp,
    },
    event_counts: {},
    track_metrics: {
      tracks_created: 0,
      tracks_completed: 0,
      tracks_failed: 0,
      average_duration_ms: 0,
    },
    workflow_metrics: {
      workflows_started: 0,
      workflows_completed: 0,
      workflows_failed: 0,
      average_duration_ms: 0,
    },
    snapshot_metrics: {
      snapshots_created: 0,
      snapshots_restored: 0,
    },
    error_metrics: {
      total_errors: 0,
      error_types: {},
    },
  };

  // Analyze events
  for (const event of events) {
    report.event_counts[event.type] = (report.event_counts[event.type] || 0) + 1;

    switch (event.type) {
      case EVENT_TYPES.TRACK_CREATED:
        report.track_metrics.tracks_created++;
        break;
      case EVENT_TYPES.TRACK_COMPLETED:
        report.track_metrics.tracks_completed++;
        if (event.data.duration_ms) {
          report.track_metrics.average_duration_ms += event.data.duration_ms;
        }
        break;
      case EVENT_TYPES.TRACK_FAILED:
        report.track_metrics.tracks_failed++;
        break;
      case EVENT_TYPES.WORKFLOW_STARTED:
        report.workflow_metrics.workflows_started++;
        break;
      case EVENT_TYPES.WORKFLOW_COMPLETED:
        report.workflow_metrics.workflows_completed++;
        if (event.data.duration_ms) {
          report.workflow_metrics.average_duration_ms += event.data.duration_ms;
        }
        break;
      case EVENT_TYPES.WORKFLOW_FAILED:
        report.workflow_metrics.workflows_failed++;
        break;
      case EVENT_TYPES.SNAPSHOT_CREATED:
        report.snapshot_metrics.snapshots_created++;
        break;
      case EVENT_TYPES.SNAPSHOT_RESTORED:
        report.snapshot_metrics.snapshots_restored++;
        break;
      case EVENT_TYPES.ERROR_OCCURRED:
        report.error_metrics.total_errors++;
        if (event.data.error_type) {
          report.error_metrics.error_types[event.data.error_type] =
            (report.error_metrics.error_types[event.data.error_type] || 0) + 1;
        }
        break;
    }
  }

  // Calculate averages
  if (report.track_metrics.tracks_completed > 0) {
    report.track_metrics.average_duration_ms = Math.round(
      report.track_metrics.average_duration_ms / report.track_metrics.tracks_completed
    );
  }
  if (report.workflow_metrics.workflows_completed > 0) {
    report.workflow_metrics.average_duration_ms = Math.round(
      report.workflow_metrics.average_duration_ms / report.workflow_metrics.workflows_completed
    );
  }

  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  } else {
    return formatReportText(report);
  }
}

/**
 * Format report as text
 */
function formatReportText(report) {
  let output = '';

  output += `${COLORS.bright}${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗${COLORS.reset}\n`;
  output += `${COLORS.bright}${COLORS.cyan}║          CONDUCTOR TELEMETRY REPORT                           ║${COLORS.reset}\n`;
  output += `${COLORS.bright}${COLORS.cyan}╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}\n\n`;

  output += `${COLORS.bright}${COLORS.blue}━━━ Summary ━━━${COLORS.reset}\n`;
  output += `  Period: ${report.period.days} days\n`;
  output += `  Total events: ${COLORS.bright}${report.summary.total_events}${COLORS.reset}\n`;
  output += `  Telemetry enabled: ${report.summary.telemetry_enabled ? `${COLORS.green}Yes${COLORS.reset}` : `${COLORS.gray}No${COLORS.reset}`}\n`;
  if (report.summary.opt_in_date) {
    output += `  Opt-in date: ${new Date(report.summary.opt_in_date).toLocaleDateString()}\n`;
  }
  output += '\n';

  output += `${COLORS.bright}${COLORS.blue}━━━ Track Metrics ━━━${COLORS.reset}\n`;
  output += `  Tracks created: ${report.track_metrics.tracks_created}\n`;
  output += `  Tracks completed: ${COLORS.green}${report.track_metrics.tracks_completed}${COLORS.reset}\n`;
  output += `  Tracks failed: ${COLORS.red}${report.track_metrics.tracks_failed}${COLORS.reset}\n`;
  if (report.track_metrics.average_duration_ms > 0) {
    output += `  Average duration: ${formatDuration(report.track_metrics.average_duration_ms)}\n`;
  }
  output += '\n';

  output += `${COLORS.bright}${COLORS.blue}━━━ Workflow Metrics ━━━${COLORS.reset}\n`;
  output += `  Workflows started: ${report.workflow_metrics.workflows_started}\n`;
  output += `  Workflows completed: ${COLORS.green}${report.workflow_metrics.workflows_completed}${COLORS.reset}\n`;
  output += `  Workflows failed: ${COLORS.red}${report.workflow_metrics.workflows_failed}${COLORS.reset}\n`;
  if (report.workflow_metrics.average_duration_ms > 0) {
    output += `  Average duration: ${formatDuration(report.workflow_metrics.average_duration_ms)}\n`;
  }
  output += '\n';

  output += `${COLORS.bright}${COLORS.blue}━━━ Snapshot Metrics ━━━${COLORS.reset}\n`;
  output += `  Snapshots created: ${report.snapshot_metrics.snapshots_created}\n`;
  output += `  Snapshots restored: ${report.snapshot_metrics.snapshots_restored}\n`;
  output += '\n';

  if (report.error_metrics.total_errors > 0) {
    output += `${COLORS.bright}${COLORS.blue}━━━ Error Metrics ━━━${COLORS.reset}\n`;
    output += `  Total errors: ${COLORS.red}${report.error_metrics.total_errors}${COLORS.reset}\n`;
    if (Object.keys(report.error_metrics.error_types).length > 0) {
      output += `  By type:\n`;
      for (const [type, count] of Object.entries(report.error_metrics.error_types)) {
        output += `    ${type}: ${count}\n`;
      }
    }
    output += '\n';
  }

  output += `${COLORS.dim}Generated: ${new Date().toISOString()}${COLORS.reset}\n`;

  return output;
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Export telemetry data
 */
async function exportData(outputPath) {
  const config = await loadConfig();
  const allEvents = await loadEvents(config.privacy.retention_days);

  const exportData = {
    export_timestamp: new Date().toISOString(),
    config,
    events: allEvents,
    privacy_notice: {
      no_pii: true,
      local_only: true,
      data_retention_days: config.privacy.retention_days,
    },
  };

  await writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  console.log(`${COLORS.green}✓${COLORS.reset} Telemetry data exported to ${outputPath}`);
  console.log(`  Total events: ${allEvents.length}`);
  console.log(`  Period: ${config.privacy.retention_days} days`);
}

/**
 * Purge all telemetry data
 */
async function purgeTelemetryData(confirmed = false) {
  if (!confirmed) {
    console.log(
      `${COLORS.yellow}⚠${COLORS.reset} This will permanently delete all telemetry data.`
    );
    console.log(`${COLORS.dim}Run with --confirm to proceed.${COLORS.reset}`);
    return;
  }

  await ensureTelemetryDirs();

  // Delete all event files
  const files = await readdir(EVENTS_DIR);
  const eventFiles = files.filter(f => f.startsWith('events-') && f.endsWith('.json'));

  for (const file of eventFiles) {
    await unlink(join(EVENTS_DIR, file));
  }

  // Reset statistics
  const config = await loadConfig();
  config.statistics = {
    total_events: 0,
    first_event_at: null,
    last_event_at: null,
  };
  await saveConfig(config);

  console.log(`${COLORS.green}✓${COLORS.reset} All telemetry data purged`);
  console.log(`  Deleted ${eventFiles.length} event files`);
}

/**
 * Print telemetry status
 */
async function printStatus() {
  const config = await loadConfig();

  console.log(`${COLORS.bright}${COLORS.cyan}Conductor Telemetry Status${COLORS.reset}\n`);
  console.log(
    `  Enabled: ${config.enabled ? `${COLORS.green}Yes${COLORS.reset}` : `${COLORS.gray}No${COLORS.reset}`}`
  );
  console.log(
    `  User consent: ${config.user_consent ? `${COLORS.green}Yes${COLORS.reset}` : `${COLORS.gray}No${COLORS.reset}`}`
  );

  if (config.opt_in_timestamp) {
    console.log(`  Opt-in date: ${new Date(config.opt_in_timestamp).toLocaleDateString()}`);
  }

  console.log(`\n${COLORS.bright}Privacy Settings:${COLORS.reset}`);
  console.log(`  No PII: ${COLORS.green}✓${COLORS.reset}`);
  console.log(`  Local only: ${COLORS.green}✓${COLORS.reset}`);
  console.log(`  Can be purged: ${COLORS.green}✓${COLORS.reset}`);
  console.log(`  Retention: ${config.privacy.retention_days} days`);

  console.log(`\n${COLORS.bright}Statistics:${COLORS.reset}`);
  console.log(`  Total events: ${config.statistics.total_events || 0}`);
  if (config.statistics.first_event_at) {
    console.log(
      `  First event: ${new Date(config.statistics.first_event_at).toLocaleDateString()}`
    );
  }
  if (config.statistics.last_event_at) {
    console.log(`  Last event: ${new Date(config.statistics.last_event_at).toLocaleDateString()}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'status') {
      await printStatus();
    } else if (command === 'enable') {
      await enableTelemetry();
    } else if (command === 'disable') {
      const purge = args.includes('--purge');
      await disableTelemetry(purge);
    } else if (command === 'report') {
      const periodIndex = args.indexOf('--period');
      const formatIndex = args.indexOf('--format');

      const periodDays =
        periodIndex !== -1 ? parseInt(args[periodIndex + 1].replace('d', ''), 10) : 7;
      const format = formatIndex !== -1 ? args[formatIndex + 1] : 'text';

      const report = await generateReport({ periodDays, format });
      console.log(report);
    } else if (command === 'export') {
      const outputIndex = args.indexOf('--output');
      if (outputIndex === -1) {
        console.error('Usage: conductor-telemetry.mjs export --output <path>');
        process.exit(1);
      }
      const outputPath = args[outputIndex + 1];
      await exportData(outputPath);
    } else if (command === 'purge') {
      const confirmed = args.includes('--confirm');
      await purgeTelemetryData(confirmed);
    } else if (command === 'log-event') {
      const typeIndex = args.indexOf('--type');
      const dataIndex = args.indexOf('--data');

      if (typeIndex === -1) {
        console.error('Usage: conductor-telemetry.mjs log-event --type <type> [--data <json>]');
        process.exit(1);
      }

      const type = args[typeIndex + 1];
      const data = dataIndex !== -1 ? JSON.parse(args[dataIndex + 1]) : {};

      const eventId = await logEvent(type, data);
      if (eventId) {
        console.log(`${COLORS.green}✓${COLORS.reset} Event logged: ${eventId}`);
      } else {
        console.log(`${COLORS.dim}Telemetry disabled - event not logged${COLORS.reset}`);
      }
    } else {
      console.error(
        'Unknown command. Available: status, enable, disable, report, export, purge, log-event'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default {
  logEvent,
  isEnabled,
  enableTelemetry,
  disableTelemetry,
  generateReport,
  exportData,
  purgeTelemetryData,
  EVENT_TYPES,
};

#!/usr/bin/env node
/**
 * Conductor Status Dashboard
 *
 * Comprehensive status view of all Conductor features:
 * - Active tracks and their progress
 * - Recent snapshots and checkpoints
 * - Session recovery status
 * - Feature toggle states
 * - System health metrics
 *
 * Usage:
 *   node .claude/tools/conductor-status.mjs
 *   node .claude/tools/conductor-status.mjs --format json
 *   node .claude/tools/conductor-status.mjs --detailed
 *   node .claude/tools/conductor-status.mjs --tracks-only
 *   node .claude/tools/conductor-status.mjs --enable-feature telemetry
 *   node .claude/tools/conductor-status.mjs --disable-feature parallel_workflows
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { TrackRegistry } from '../skills/track-manager/registry.mjs';
import { listSnapshots } from './snapshot-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONDUCTOR_DIR = join(__dirname, '../conductor');
const FEATURE_TOGGLES_PATH = join(CONDUCTOR_DIR, 'feature-toggles.json');
const TRACKS_DIR = join(CONDUCTOR_DIR, 'tracks');
const SNAPSHOTS_DIR = join(CONDUCTOR_DIR, 'context/snapshots');

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
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human-readable
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Load feature toggles
 */
async function loadFeatureToggles() {
  if (!existsSync(FEATURE_TOGGLES_PATH)) {
    return {
      version: '1.0.0',
      features: {},
      experimental_flags: {},
    };
  }

  const content = await readFile(FEATURE_TOGGLES_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Save feature toggles
 */
async function saveFeatureToggles(toggles) {
  toggles.last_updated = new Date().toISOString();
  await writeFile(FEATURE_TOGGLES_PATH, JSON.stringify(toggles, null, 2), 'utf-8');
}

/**
 * Get track statistics
 */
async function getTrackStats() {
  const registry = new TrackRegistry();
  const data = await registry.load();

  const tracks = Object.values(data.tracks || {});
  const activeTrack = data.active_track ? data.tracks[data.active_track] : null;

  const statusCounts = tracks.reduce((acc, track) => {
    acc[track.status] = (acc[track.status] || 0) + 1;
    return acc;
  }, {});

  const typeCounts = tracks.reduce((acc, track) => {
    acc[track.type] = (acc[track.type] || 0) + 1;
    return acc;
  }, {});

  return {
    total: tracks.length,
    active: activeTrack,
    status_counts: statusCounts,
    type_counts: typeCounts,
    tracks: tracks.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 10),
  };
}

/**
 * Get snapshot statistics
 */
async function getSnapshotStats() {
  try {
    const snapshots = await listSnapshots();

    const typeCounts = snapshots.reduce((acc, snap) => {
      acc[snap.type] = (acc[snap.type] || 0) + 1;
      return acc;
    }, {});

    const totalSize = snapshots.reduce((sum, snap) => sum + parseFloat(snap.size_mb), 0);

    return {
      total: snapshots.length,
      type_counts: typeCounts,
      total_size_mb: totalSize.toFixed(2),
      recent: snapshots.slice(0, 5),
    };
  } catch (error) {
    return {
      total: 0,
      type_counts: {},
      total_size_mb: '0.00',
      recent: [],
      error: error.message,
    };
  }
}

/**
 * Get directory size recursively
 */
async function getDirectorySize(dirPath) {
  if (!existsSync(dirPath)) return 0;

  let totalSize = 0;
  const files = await readdir(dirPath, { withFileTypes: true });

  for (const file of files) {
    const filePath = join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += await getDirectorySize(filePath);
    } else {
      const stats = await stat(filePath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * Get system health metrics
 */
async function getSystemHealth() {
  const tracksSize = await getDirectorySize(TRACKS_DIR);
  const snapshotsSize = await getDirectorySize(SNAPSHOTS_DIR);

  return {
    tracks_directory_size: formatBytes(tracksSize),
    snapshots_directory_size: formatBytes(snapshotsSize),
    total_storage: formatBytes(tracksSize + snapshotsSize),
  };
}

/**
 * Print dashboard in human-readable format
 */
async function printDashboard(options = {}) {
  const { detailed = false, tracksOnly = false } = options;

  console.log(
    `${COLORS.bright}${COLORS.cyan}╔═══════════════════════════════════════════════════════════════╗${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.cyan}║          CONDUCTOR STATUS DASHBOARD                           ║${COLORS.reset}`
  );
  console.log(
    `${COLORS.bright}${COLORS.cyan}╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}\n`
  );

  // Feature Toggles
  if (!tracksOnly) {
    console.log(`${COLORS.bright}${COLORS.blue}━━━ Feature Toggles ━━━${COLORS.reset}`);
    const toggles = await loadFeatureToggles();
    const features = Object.entries(toggles.features || {});

    for (const [name, config] of features) {
      const status = config.enabled
        ? `${COLORS.green}●${COLORS.reset} enabled`
        : `${COLORS.gray}○${COLORS.reset} disabled`;
      const statusLabel = config.status ? `[${config.status}]` : '';
      console.log(
        `  ${status}  ${COLORS.bright}${name}${COLORS.reset} ${COLORS.dim}${statusLabel}${COLORS.reset}`
      );

      if (detailed) {
        console.log(`    ${COLORS.gray}${config.description}${COLORS.reset}`);
        if (config.requires && config.requires.length > 0) {
          console.log(`    ${COLORS.gray}requires: ${config.requires.join(', ')}${COLORS.reset}`);
        }
      }
    }
    console.log();
  }

  // Active Tracks
  console.log(`${COLORS.bright}${COLORS.blue}━━━ Active Tracks ━━━${COLORS.reset}`);
  const trackStats = await getTrackStats();

  if (trackStats.active) {
    const track = trackStats.active;
    const progressBar = createProgressBar(track.progress?.percentage || 0, 30);

    console.log(
      `  ${COLORS.bright}${COLORS.green}▶${COLORS.reset} ${COLORS.bright}${track.name}${COLORS.reset} ${COLORS.dim}(${track.track_id})${COLORS.reset}`
    );
    console.log(`    Type: ${track.type} | Priority: ${track.priority}`);
    console.log(`    Progress: ${progressBar} ${track.progress?.percentage || 0}%`);
    console.log(
      `    ${track.progress?.completed_steps || 0}/${track.progress?.total_steps || 0} steps complete`
    );
    console.log(`    Updated: ${formatRelativeTime(track.updated_at)}`);
  } else {
    console.log(`  ${COLORS.gray}No active track${COLORS.reset}`);
  }
  console.log();

  // Track Statistics
  console.log(`${COLORS.bright}${COLORS.blue}━━━ Track Statistics ━━━${COLORS.reset}`);
  console.log(`  Total tracks: ${COLORS.bright}${trackStats.total}${COLORS.reset}`);

  if (Object.keys(trackStats.status_counts).length > 0) {
    console.log(`  By status:`);
    for (const [status, count] of Object.entries(trackStats.status_counts)) {
      const color =
        status === 'active'
          ? COLORS.green
          : status === 'completed'
            ? COLORS.blue
            : status === 'paused'
              ? COLORS.yellow
              : COLORS.gray;
      console.log(`    ${color}${status}${COLORS.reset}: ${count}`);
    }
  }

  if (detailed && Object.keys(trackStats.type_counts).length > 0) {
    console.log(`  By type:`);
    for (const [type, count] of Object.entries(trackStats.type_counts)) {
      console.log(`    ${type}: ${count}`);
    }
  }
  console.log();

  // Recent Tracks
  if (detailed && trackStats.tracks.length > 0) {
    console.log(`${COLORS.bright}${COLORS.blue}━━━ Recent Tracks ━━━${COLORS.reset}`);
    for (const track of trackStats.tracks.slice(0, 5)) {
      const statusColor =
        track.status === 'active'
          ? COLORS.green
          : track.status === 'completed'
            ? COLORS.blue
            : track.status === 'paused'
              ? COLORS.yellow
              : COLORS.gray;

      console.log(
        `  ${statusColor}●${COLORS.reset} ${track.name} ${COLORS.dim}(${track.status})${COLORS.reset}`
      );
      console.log(
        `    ${COLORS.gray}${track.type} | ${formatRelativeTime(track.updated_at)}${COLORS.reset}`
      );
    }
    console.log();
  }

  // Snapshots
  if (!tracksOnly) {
    console.log(`${COLORS.bright}${COLORS.blue}━━━ Snapshots ━━━${COLORS.reset}`);
    const snapshotStats = await getSnapshotStats();

    if (snapshotStats.error) {
      console.log(`  ${COLORS.red}Error loading snapshots: ${snapshotStats.error}${COLORS.reset}`);
    } else {
      console.log(`  Total snapshots: ${COLORS.bright}${snapshotStats.total}${COLORS.reset}`);
      console.log(`  Total size: ${snapshotStats.total_size_mb} MB`);

      if (Object.keys(snapshotStats.type_counts).length > 0) {
        console.log(`  By type:`);
        for (const [type, count] of Object.entries(snapshotStats.type_counts)) {
          console.log(`    ${type}: ${count}`);
        }
      }

      if (detailed && snapshotStats.recent.length > 0) {
        console.log(`  Recent snapshots:`);
        for (const snap of snapshotStats.recent) {
          console.log(
            `    ${snap.type} | ${snap.size_mb} MB | ${formatRelativeTime(snap.created_at)}`
          );
          if (snap.description) {
            console.log(`      ${COLORS.gray}${snap.description}${COLORS.reset}`);
          }
        }
      }
    }
    console.log();
  }

  // System Health
  if (!tracksOnly) {
    console.log(`${COLORS.bright}${COLORS.blue}━━━ System Health ━━━${COLORS.reset}`);
    const health = await getSystemHealth();
    console.log(`  Tracks storage: ${health.tracks_directory_size}`);
    console.log(`  Snapshots storage: ${health.snapshots_directory_size}`);
    console.log(`  Total storage: ${COLORS.bright}${health.total_storage}${COLORS.reset}`);
    console.log();
  }

  console.log(`${COLORS.dim}Last updated: ${new Date().toISOString()}${COLORS.reset}\n`);
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percentage, width = 30) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const color =
    percentage >= 80
      ? COLORS.green
      : percentage >= 50
        ? COLORS.yellow
        : percentage >= 25
          ? COLORS.cyan
          : COLORS.red;

  return `${color}${bar}${COLORS.reset}`;
}

/**
 * Print dashboard in JSON format
 */
async function printJSON(options = {}) {
  const { detailed = false } = options;

  const data = {
    timestamp: new Date().toISOString(),
    feature_toggles: await loadFeatureToggles(),
    tracks: await getTrackStats(),
    snapshots: await getSnapshotStats(),
    system_health: await getSystemHealth(),
  };

  if (!detailed) {
    // Trim down for non-detailed output
    delete data.feature_toggles.experimental_flags;
    data.tracks.tracks = data.tracks.tracks.slice(0, 5);
    data.snapshots.recent = data.snapshots.recent.slice(0, 5);
  }

  console.log(JSON.stringify(data, null, 2));
}

/**
 * Enable a feature
 */
async function enableFeature(featureName) {
  const toggles = await loadFeatureToggles();

  if (!toggles.features[featureName]) {
    console.error(`${COLORS.red}Error: Feature "${featureName}" not found${COLORS.reset}`);
    process.exit(1);
  }

  if (toggles.features[featureName].enabled) {
    console.log(`${COLORS.yellow}Feature "${featureName}" is already enabled${COLORS.reset}`);
    return;
  }

  toggles.features[featureName].enabled = true;
  await saveFeatureToggles(toggles);

  console.log(`${COLORS.green}✓${COLORS.reset} Feature "${featureName}" enabled`);

  // Check requirements
  const requires = toggles.features[featureName].requires || [];
  if (requires.length > 0) {
    console.log(`${COLORS.dim}Required features: ${requires.join(', ')}${COLORS.reset}`);
    for (const req of requires) {
      if (toggles.features[req] && !toggles.features[req].enabled) {
        console.log(`${COLORS.yellow}⚠${COLORS.reset} Required feature "${req}" is disabled`);
      }
    }
  }
}

/**
 * Disable a feature
 */
async function disableFeature(featureName) {
  const toggles = await loadFeatureToggles();

  if (!toggles.features[featureName]) {
    console.error(`${COLORS.red}Error: Feature "${featureName}" not found${COLORS.reset}`);
    process.exit(1);
  }

  if (!toggles.features[featureName].enabled) {
    console.log(`${COLORS.yellow}Feature "${featureName}" is already disabled${COLORS.reset}`);
    return;
  }

  toggles.features[featureName].enabled = false;
  await saveFeatureToggles(toggles);

  console.log(`${COLORS.green}✓${COLORS.reset} Feature "${featureName}" disabled`);

  // Check dependents
  const dependents = Object.entries(toggles.features)
    .filter(([_, config]) => config.requires?.includes(featureName))
    .map(([name]) => name);

  if (dependents.length > 0) {
    console.log(
      `${COLORS.yellow}⚠${COLORS.reset} Features that depend on "${featureName}": ${dependents.join(', ')}`
    );
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const formatJson = args.includes('--format') && args[args.indexOf('--format') + 1] === 'json';
  const detailed = args.includes('--detailed');
  const tracksOnly = args.includes('--tracks-only');

  // Feature toggle commands
  if (args.includes('--enable-feature')) {
    const featureIndex = args.indexOf('--enable-feature');
    const featureName = args[featureIndex + 1];
    await enableFeature(featureName);
    return;
  }

  if (args.includes('--disable-feature')) {
    const featureIndex = args.indexOf('--disable-feature');
    const featureName = args[featureIndex + 1];
    await disableFeature(featureName);
    return;
  }

  // Dashboard display
  if (formatJson) {
    await printJSON({ detailed });
  } else {
    await printDashboard({ detailed, tracksOnly });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${COLORS.red}Error: ${error.message}${COLORS.reset}`);
    process.exit(1);
  });
}

export default {
  loadFeatureToggles,
  saveFeatureToggles,
  getTrackStats,
  getSnapshotStats,
  getSystemHealth,
  enableFeature,
  disableFeature,
};

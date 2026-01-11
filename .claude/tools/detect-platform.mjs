#!/usr/bin/env node
/**
 * Platform Detection Utility
 * Detects current platform and loads appropriate adapter
 *
 * @module tools/detect-platform
 * @version 1.0.0
 *
 * Usage:
 *   node .claude/tools/detect-platform.mjs [--json]
 *   node .claude/tools/detect-platform.mjs --translate <workflow.yaml> --platform <platform>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Detect current platform based on environment and files
 * @returns {string} Platform identifier (claude, cursor, factory)
 */
function detectPlatform() {
  // Check environment variables first (highest priority)
  if (process.env.CLAUDE_CODE || process.env.ANTHROPIC_API_KEY) {
    return 'claude';
  }

  if (process.env.CURSOR_SESSION) {
    return 'cursor';
  }

  if (process.env.FACTORY_DROID) {
    return 'factory';
  }

  // Check for platform-specific files
  const projectRoot = findProjectRoot();

  if (
    fs.existsSync(path.join(projectRoot, '.claude', 'CLAUDE.md')) ||
    fs.existsSync(path.join(projectRoot, '.claude', 'config.yaml'))
  ) {
    return 'claude';
  }

  if (
    fs.existsSync(path.join(projectRoot, '.cursor', 'settings.json')) ||
    fs.existsSync(path.join(projectRoot, '.cursorrules'))
  ) {
    return 'cursor';
  }

  if (fs.existsSync(path.join(projectRoot, '.factory', 'config.json'))) {
    return 'factory';
  }

  // Default to claude
  return 'claude';
}

/**
 * Find project root by looking for common markers
 * @returns {string} Project root path
 */
function findProjectRoot() {
  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (
      fs.existsSync(path.join(currentDir, 'package.json')) ||
      fs.existsSync(path.join(currentDir, '.git')) ||
      fs.existsSync(path.join(currentDir, '.claude'))
    ) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

/**
 * Load adapter registry
 * @returns {Object} Registry configuration
 */
function loadRegistry() {
  const registryPath = path.join(__dirname, '..', 'platform-adapters', 'adapter-registry.json');

  if (!fs.existsSync(registryPath)) {
    throw new Error(`Adapter registry not found at ${registryPath}`);
  }

  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

/**
 * Load platform adapter dynamically
 * @param {string} platform - Platform identifier
 * @returns {Promise<BasePlatformAdapter>} Adapter instance
 */
async function loadAdapter(platform) {
  const registry = loadRegistry();

  const adapterInfo = registry.adapters[platform];
  if (!adapterInfo) {
    throw new Error(
      `Unknown platform: ${platform}. Available: ${Object.keys(registry.adapters).join(', ')}`
    );
  }

  const adapterPath = path.join(__dirname, '..', 'platform-adapters', adapterInfo.file);

  if (!fs.existsSync(adapterPath)) {
    throw new Error(`Adapter file not found: ${adapterPath}`);
  }

  const module = await import(`file://${adapterPath}`);
  return new module[adapterInfo.class]();
}

/**
 * Get platform capabilities
 * @param {string} platform - Platform identifier
 * @returns {Object} Capabilities summary
 */
function getPlatformCapabilities(platform) {
  const registry = loadRegistry();
  const adapterInfo = registry.adapters[platform];

  if (!adapterInfo) {
    return null;
  }

  return {
    platform,
    native: adapterInfo.native,
    capabilities: adapterInfo.capabilities,
    cuj_support: adapterInfo.cuj_support,
    recommended_for: adapterInfo.recommended_for || [],
    limitations: adapterInfo.limitations || [],
  };
}

/**
 * Compare capabilities between platforms
 * @param {string} from - Source platform
 * @param {string} to - Target platform
 * @returns {Object} Comparison result
 */
function compareCapabilities(from, to) {
  const registry = loadRegistry();
  const fromInfo = registry.adapters[from];
  const toInfo = registry.adapters[to];

  if (!fromInfo || !toInfo) {
    throw new Error(`Invalid platform: ${!fromInfo ? from : to}`);
  }

  const translationKey = `${from}_to_${to}`;
  const translation = registry.translation_matrix[translationKey] || {
    difficulty: 'unknown',
    automation: 'unknown',
    fidelity: 'unknown',
  };

  const capabilityLoss = [];
  for (const [cap, fromValue] of Object.entries(fromInfo.capabilities)) {
    const toValue = toInfo.capabilities[cap];
    if (fromValue === 'full' && toValue !== 'full') {
      capabilityLoss.push({
        capability: cap,
        from: fromValue,
        to: toValue,
      });
    }
  }

  return {
    from,
    to,
    translation,
    capability_loss: capabilityLoss,
    warnings:
      capabilityLoss.length > 0 ? [`${capabilityLoss.length} capabilities will be degraded`] : [],
  };
}

/**
 * Get all available platforms
 * @returns {Array} Platform list with info
 */
function getAvailablePlatforms() {
  const registry = loadRegistry();
  return Object.entries(registry.adapters).map(([id, info]) => ({
    id,
    name: info.class.replace('Adapter', ''),
    native: info.native,
    cuj_support: info.cuj_support,
  }));
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Platform Detection Utility

Usage:
  detect-platform.mjs                    Detect and show current platform
  detect-platform.mjs --json             Output detection result as JSON
  detect-platform.mjs --list             List all available platforms
  detect-platform.mjs --capabilities     Show current platform capabilities
  detect-platform.mjs --compare <from> <to>  Compare two platforms
  detect-platform.mjs --translate <workflow> --platform <target>
                                         Translate workflow to target platform

Options:
  --json        Output as JSON
  --list        List available platforms
  --capabilities Show platform capabilities
  --compare     Compare platform capabilities
  --translate   Translate workflow file
  --platform    Target platform for translation
  --help, -h    Show this help
`);
    process.exit(0);
  }

  const outputJson = args.includes('--json');

  if (args.includes('--list')) {
    const platforms = getAvailablePlatforms();
    if (outputJson) {
      console.log(JSON.stringify(platforms, null, 2));
    } else {
      console.log('Available Platforms:');
      for (const p of platforms) {
        console.log(`  ${p.id}: ${p.name} (CUJ: ${p.cuj_support})${p.native ? ' [native]' : ''}`);
      }
    }
    return;
  }

  if (args.includes('--compare')) {
    const compareIdx = args.indexOf('--compare');
    const from = args[compareIdx + 1];
    const to = args[compareIdx + 2];

    if (!from || !to) {
      console.error('Error: --compare requires two platform arguments');
      process.exit(1);
    }

    const comparison = compareCapabilities(from, to);
    if (outputJson) {
      console.log(JSON.stringify(comparison, null, 2));
    } else {
      console.log(`Comparison: ${from} -> ${to}`);
      console.log(`  Difficulty: ${comparison.translation.difficulty}`);
      console.log(`  Automation: ${comparison.translation.automation}`);
      console.log(`  Fidelity: ${comparison.translation.fidelity}`);
      if (comparison.capability_loss.length > 0) {
        console.log('  Capability Loss:');
        for (const loss of comparison.capability_loss) {
          console.log(`    - ${loss.capability}: ${loss.from} -> ${loss.to}`);
        }
      }
    }
    return;
  }

  if (args.includes('--translate')) {
    const translateIdx = args.indexOf('--translate');
    const workflowPath = args[translateIdx + 1];
    const platformIdx = args.indexOf('--platform');
    const targetPlatform = platformIdx !== -1 ? args[platformIdx + 1] : null;

    if (!workflowPath) {
      console.error('Error: --translate requires a workflow file path');
      process.exit(1);
    }

    if (!targetPlatform) {
      console.error('Error: --translate requires --platform <target>');
      process.exit(1);
    }

    if (!fs.existsSync(workflowPath)) {
      console.error(`Error: Workflow file not found: ${workflowPath}`);
      process.exit(1);
    }

    const adapter = await loadAdapter(targetPlatform);
    const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
    const translated = adapter.translateWorkflow(workflow);

    console.log(JSON.stringify(translated, null, 2));
    return;
  }

  // Default: detect platform
  const platform = detectPlatform();

  if (args.includes('--capabilities')) {
    const capabilities = getPlatformCapabilities(platform);
    if (outputJson) {
      console.log(JSON.stringify(capabilities, null, 2));
    } else {
      console.log(`Platform: ${capabilities.platform}`);
      console.log(`Native: ${capabilities.native}`);
      console.log(`CUJ Support: ${capabilities.cuj_support}`);
      console.log('Capabilities:');
      for (const [cap, value] of Object.entries(capabilities.capabilities)) {
        console.log(`  ${cap}: ${value}`);
      }
    }
    return;
  }

  if (outputJson) {
    console.log(JSON.stringify({ platform, detected: true }, null, 2));
  } else {
    console.log(`Detected platform: ${platform}`);
  }
}

// Export functions for programmatic use
export {
  detectPlatform,
  loadAdapter,
  getPlatformCapabilities,
  compareCapabilities,
  getAvailablePlatforms,
  findProjectRoot,
};

// Run CLI if executed directly
if (process.argv[1].endsWith('detect-platform.mjs')) {
  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

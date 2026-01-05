#!/usr/bin/env node
/**
 * Skill Porter - Cross-platform conversion for Claude Skills ↔ Gemini Extensions
 *
 * Based on: https://github.com/jduncan-rva/skill-porter
 *
 * Usage:
 *   node port.cjs <path> --to gemini     Convert Claude skill to Gemini extension
 *   node port.cjs <path> --to claude     Convert Gemini extension to Claude skill
 *   node port.cjs <path> --universal     Make skill work on both platforms
 *   node port.cjs <path> --analyze       Detect platform and show conversion info
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Platform detection patterns
const CLAUDE_INDICATORS = ['SKILL.md', '.claude-plugin', 'marketplace.json'];
const GEMINI_INDICATORS = ['gemini-extension.json', 'GEMINI.md'];

// Standard tools for allowlist/denylist conversion
const ALL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite'];

/**
 * Detect platform type from directory structure
 */
function detectPlatform(dirPath) {
  const files = fs.readdirSync(dirPath);

  const claudeScore = CLAUDE_INDICATORS.filter(f =>
    files.includes(f) || fs.existsSync(path.join(dirPath, f))
  ).length;

  const geminiScore = GEMINI_INDICATORS.filter(f =>
    files.includes(f) || fs.existsSync(path.join(dirPath, f))
  ).length;

  if (claudeScore > 0 && geminiScore > 0) {
    return { platform: 'universal', claudeScore, geminiScore };
  } else if (claudeScore > geminiScore) {
    return { platform: 'claude', claudeScore, geminiScore };
  } else if (geminiScore > claudeScore) {
    return { platform: 'gemini', claudeScore, geminiScore };
  }

  return { platform: 'unknown', claudeScore, geminiScore };
}

/**
 * Parse SKILL.md frontmatter
 */
function parseSkillMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error('No YAML frontmatter found in SKILL.md');
  }

  const frontmatter = yaml.load(frontmatterMatch[1]);
  const body = content.slice(frontmatterMatch[0].length).trim();

  return { frontmatter, body, raw: content };
}

/**
 * Parse gemini-extension.json
 */
function parseGeminiExtension(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Convert allowed-tools (allowlist) to excludeTools (denylist)
 */
function allowlistToDenylist(allowedTools) {
  if (!allowedTools || allowedTools.length === 0) {
    return []; // No restrictions = no exclusions
  }
  return ALL_TOOLS.filter(tool => !allowedTools.includes(tool));
}

/**
 * Convert excludeTools (denylist) to allowed-tools (allowlist)
 */
function denylistToAllowlist(excludeTools) {
  if (!excludeTools || excludeTools.length === 0) {
    return []; // No exclusions = all allowed (empty means no restriction)
  }
  return ALL_TOOLS.filter(tool => !excludeTools.includes(tool));
}

/**
 * Convert Claude SKILL.md to Gemini gemini-extension.json
 */
function claudeToGemini(sourcePath, outputPath) {
  const skillPath = path.join(sourcePath, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found in ${sourcePath}`);
  }

  const { frontmatter, body } = parseSkillMd(skillPath);

  // Create gemini-extension.json
  const geminiExtension = {
    name: frontmatter.name || path.basename(sourcePath),
    version: frontmatter.version || '1.0.0',
    description: frontmatter.description || '',
    contextFilename: 'GEMINI.md'
  };

  // Convert allowed-tools to excludeTools
  if (frontmatter['allowed-tools']) {
    const excludeTools = allowlistToDenylist(frontmatter['allowed-tools']);
    if (excludeTools.length > 0) {
      geminiExtension.excludeTools = excludeTools;
    }
  }

  // Handle MCP servers if present
  const mcpConfigPath = path.join(sourcePath, 'config.json');
  if (fs.existsSync(mcpConfigPath)) {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    geminiExtension.mcpServers = {
      [mcpConfig.skill_name || frontmatter.name]: {
        command: mcpConfig.command,
        args: mcpConfig.args?.map(arg =>
          arg.replace(/\$\{skillPath\}/g, '${extensionPath}')
        ) || []
      }
    };

    // Convert env vars to settings
    if (mcpConfig.env) {
      geminiExtension.settings = {};
      for (const [key, value] of Object.entries(mcpConfig.env)) {
        geminiExtension.settings[key] = {
          description: `Environment variable: ${key}`,
          required: false,
          secret: key.toLowerCase().includes('key') ||
                  key.toLowerCase().includes('token') ||
                  key.toLowerCase().includes('secret')
        };
      }
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(outputPath, { recursive: true });

  // Write gemini-extension.json
  fs.writeFileSync(
    path.join(outputPath, 'gemini-extension.json'),
    JSON.stringify(geminiExtension, null, 2)
  );

  // Create GEMINI.md from SKILL.md body
  const geminiMd = `# ${frontmatter.name || path.basename(sourcePath)}\n\n${frontmatter.description || ''}\n\n${body}`;
  fs.writeFileSync(path.join(outputPath, 'GEMINI.md'), geminiMd);

  // Copy shared resources
  const sharedPath = path.join(sourcePath, 'shared');
  if (fs.existsSync(sharedPath)) {
    copyDir(sharedPath, path.join(outputPath, 'shared'));
  }

  // Copy scripts as servers
  const scriptsPath = path.join(sourcePath, 'scripts');
  if (fs.existsSync(scriptsPath)) {
    copyDir(scriptsPath, path.join(outputPath, 'servers'));
  }

  return {
    success: true,
    files: ['gemini-extension.json', 'GEMINI.md'],
    target: 'gemini'
  };
}

/**
 * Convert Gemini gemini-extension.json to Claude SKILL.md
 */
function geminiToClaude(sourcePath, outputPath) {
  const extensionPath = path.join(sourcePath, 'gemini-extension.json');
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`gemini-extension.json not found in ${sourcePath}`);
  }

  const extension = parseGeminiExtension(extensionPath);

  // Build SKILL.md frontmatter
  const frontmatter = {
    name: extension.name,
    description: extension.description || ''
  };

  // Convert excludeTools to allowed-tools
  if (extension.excludeTools && extension.excludeTools.length > 0) {
    frontmatter['allowed-tools'] = denylistToAllowlist(extension.excludeTools);
  }

  if (extension.version) {
    frontmatter.version = extension.version;
  }

  // Read GEMINI.md for body content
  let body = '';
  const geminiMdPath = path.join(sourcePath, extension.contextFilename || 'GEMINI.md');
  if (fs.existsSync(geminiMdPath)) {
    body = fs.readFileSync(geminiMdPath, 'utf8');
    // Remove the first heading if it matches the name
    body = body.replace(new RegExp(`^#\\s*${extension.name}\\s*\n+`, 'i'), '');
    // Remove description if it's duplicated at the start
    if (extension.description) {
      body = body.replace(new RegExp(`^${escapeRegex(extension.description)}\\s*\n+`, 'i'), '');
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(outputPath, { recursive: true });

  // Write SKILL.md
  const skillMd = `---\n${yaml.dump(frontmatter)}---\n\n# ${extension.name}\n\n${body}`;
  fs.writeFileSync(path.join(outputPath, 'SKILL.md'), skillMd);

  // Create config.json from MCP servers
  if (extension.mcpServers) {
    const serverName = Object.keys(extension.mcpServers)[0];
    const serverConfig = extension.mcpServers[serverName];

    const config = {
      skill_name: extension.name,
      command: serverConfig.command,
      args: serverConfig.args?.map(arg =>
        arg.replace(/\$\{extensionPath\}/g, '${skillPath}')
      ) || [],
      description: extension.description,
      source: `Converted from Gemini extension`
    };

    // Convert settings to env
    if (extension.settings) {
      config.env = {};
      for (const key of Object.keys(extension.settings)) {
        config.env[key] = `\${${key}}`;
      }
    }

    fs.writeFileSync(
      path.join(outputPath, 'config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  // Copy shared resources
  const sharedPath = path.join(sourcePath, 'shared');
  if (fs.existsSync(sharedPath)) {
    copyDir(sharedPath, path.join(outputPath, 'shared'));
  }

  // Copy servers as scripts
  const serversPath = path.join(sourcePath, 'servers');
  if (fs.existsSync(serversPath)) {
    copyDir(serversPath, path.join(outputPath, 'scripts'));
  }

  return {
    success: true,
    files: ['SKILL.md', 'config.json'],
    target: 'claude'
  };
}

/**
 * Make a skill/extension universal (works on both platforms)
 */
function makeUniversal(sourcePath, outputPath) {
  const detection = detectPlatform(sourcePath);

  if (detection.platform === 'universal') {
    console.log('Skill is already universal (has both SKILL.md and gemini-extension.json)');
    return { success: true, alreadyUniversal: true };
  }

  // Copy source to output first
  if (sourcePath !== outputPath) {
    copyDir(sourcePath, outputPath);
  }

  // Add missing platform files
  if (detection.platform === 'claude') {
    // Add Gemini files
    const result = claudeToGemini(sourcePath, outputPath);

    // Also keep the original Claude files
    const skillPath = path.join(sourcePath, 'SKILL.md');
    if (fs.existsSync(skillPath) && sourcePath !== outputPath) {
      fs.copyFileSync(skillPath, path.join(outputPath, 'SKILL.md'));
    }

    return { ...result, universal: true };
  } else if (detection.platform === 'gemini') {
    // Add Claude files
    const result = geminiToClaude(sourcePath, outputPath);

    // Also keep the original Gemini files
    const extensionPath = path.join(sourcePath, 'gemini-extension.json');
    if (fs.existsSync(extensionPath) && sourcePath !== outputPath) {
      fs.copyFileSync(extensionPath, path.join(outputPath, 'gemini-extension.json'));
    }
    const geminiMdPath = path.join(sourcePath, 'GEMINI.md');
    if (fs.existsSync(geminiMdPath) && sourcePath !== outputPath) {
      fs.copyFileSync(geminiMdPath, path.join(outputPath, 'GEMINI.md'));
    }

    return { ...result, universal: true };
  }

  throw new Error(`Cannot determine platform type for ${sourcePath}`);
}

/**
 * Analyze a skill/extension and report conversion info
 */
function analyze(dirPath) {
  const detection = detectPlatform(dirPath);
  const result = {
    path: dirPath,
    platform: detection.platform,
    scores: {
      claude: detection.claudeScore,
      gemini: detection.geminiScore
    },
    files: {
      claude: [],
      gemini: [],
      shared: []
    },
    metadata: {}
  };

  // Check for specific files
  const files = fs.readdirSync(dirPath);

  if (files.includes('SKILL.md')) {
    result.files.claude.push('SKILL.md');
    try {
      const { frontmatter } = parseSkillMd(path.join(dirPath, 'SKILL.md'));
      result.metadata.claude = frontmatter;
    } catch (e) {
      result.metadata.claudeError = e.message;
    }
  }

  if (files.includes('gemini-extension.json')) {
    result.files.gemini.push('gemini-extension.json');
    try {
      result.metadata.gemini = parseGeminiExtension(path.join(dirPath, 'gemini-extension.json'));
    } catch (e) {
      result.metadata.geminiError = e.message;
    }
  }

  if (files.includes('GEMINI.md')) result.files.gemini.push('GEMINI.md');
  if (files.includes('config.json')) result.files.claude.push('config.json');
  if (files.includes('executor.py')) result.files.claude.push('executor.py');
  if (files.includes('shared')) result.files.shared.push('shared/');
  if (files.includes('scripts')) result.files.claude.push('scripts/');
  if (files.includes('servers')) result.files.gemini.push('servers/');
  if (files.includes('commands')) result.files.gemini.push('commands/');

  // Conversion recommendations
  result.recommendations = [];

  if (detection.platform === 'claude') {
    result.recommendations.push('Can convert to Gemini with: node port.cjs <path> --to gemini');
    result.recommendations.push('Can make universal with: node port.cjs <path> --universal');
  } else if (detection.platform === 'gemini') {
    result.recommendations.push('Can convert to Claude with: node port.cjs <path> --to claude');
    result.recommendations.push('Can make universal with: node port.cjs <path> --universal');
  } else if (detection.platform === 'universal') {
    result.recommendations.push('Already supports both platforms');
  } else {
    result.recommendations.push('Cannot determine platform. Ensure SKILL.md or gemini-extension.json exists.');
  }

  return result;
}

// Utility functions
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// CLI
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Skill Porter - Cross-platform skill conversion

Usage:
  node port.cjs <path> --to gemini     Convert Claude skill to Gemini extension
  node port.cjs <path> --to claude     Convert Gemini extension to Claude skill
  node port.cjs <path> --universal     Make skill work on both platforms
  node port.cjs <path> --analyze       Detect platform and show conversion info

Options:
  --output, -o <path>    Output directory (default: <source>-<target>)
  --force, -f            Overwrite existing output
  --help, -h             Show this help

Examples:
  node port.cjs .claude/skills/my-skill --to gemini
  node port.cjs ./gemini-ext --to claude --output .claude/skills/converted
  node port.cjs .claude/skills/my-skill --universal
  node port.cjs ./some-skill --analyze
`);
    process.exit(0);
  }

  const sourcePath = args[0];

  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Path not found: ${sourcePath}`);
    process.exit(1);
  }

  // Parse options
  const toIndex = args.indexOf('--to');
  const outputIndex = args.findIndex(a => a === '--output' || a === '-o');
  const isUniversal = args.includes('--universal');
  const isAnalyze = args.includes('--analyze');
  const force = args.includes('--force') || args.includes('-f');

  try {
    if (isAnalyze) {
      const result = analyze(sourcePath);
      console.log('\n=== Skill Analysis ===\n');
      console.log(`Path: ${result.path}`);
      console.log(`Platform: ${result.platform}`);
      console.log(`Scores: Claude=${result.scores.claude}, Gemini=${result.scores.gemini}`);
      console.log(`\nClaude files: ${result.files.claude.join(', ') || 'none'}`);
      console.log(`Gemini files: ${result.files.gemini.join(', ') || 'none'}`);
      console.log(`Shared files: ${result.files.shared.join(', ') || 'none'}`);

      if (result.metadata.claude) {
        console.log(`\nClaude metadata:`);
        console.log(`  Name: ${result.metadata.claude.name}`);
        console.log(`  Description: ${result.metadata.claude.description?.slice(0, 80)}...`);
      }

      if (result.metadata.gemini) {
        console.log(`\nGemini metadata:`);
        console.log(`  Name: ${result.metadata.gemini.name}`);
        console.log(`  Description: ${result.metadata.gemini.description?.slice(0, 80)}...`);
      }

      console.log(`\nRecommendations:`);
      result.recommendations.forEach(r => console.log(`  - ${r}`));
      console.log('');

    } else if (isUniversal) {
      let outputPath = sourcePath;
      if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputPath = args[outputIndex + 1];
      }

      if (fs.existsSync(outputPath) && outputPath !== sourcePath && !force) {
        console.error(`Error: Output path exists: ${outputPath}. Use --force to overwrite.`);
        process.exit(1);
      }

      console.log(`Making ${sourcePath} universal...`);
      const result = makeUniversal(sourcePath, outputPath);

      if (result.alreadyUniversal) {
        console.log('Skill is already universal!');
      } else {
        console.log(`Success! Created universal skill at: ${outputPath}`);
        console.log(`Files added: ${result.files.join(', ')}`);
      }

    } else if (toIndex !== -1) {
      const targetPlatform = args[toIndex + 1];

      if (!['gemini', 'claude'].includes(targetPlatform)) {
        console.error(`Error: Invalid target platform: ${targetPlatform}. Use 'gemini' or 'claude'.`);
        process.exit(1);
      }

      let outputPath;
      if (outputIndex !== -1 && args[outputIndex + 1]) {
        outputPath = args[outputIndex + 1];
      } else {
        outputPath = `${sourcePath}-${targetPlatform}`;
      }

      if (fs.existsSync(outputPath) && !force) {
        console.error(`Error: Output path exists: ${outputPath}. Use --force to overwrite.`);
        process.exit(1);
      }

      console.log(`Converting ${sourcePath} to ${targetPlatform}...`);

      let result;
      if (targetPlatform === 'gemini') {
        result = claudeToGemini(sourcePath, outputPath);
      } else {
        result = geminiToClaude(sourcePath, outputPath);
      }

      console.log(`Success! Converted to ${targetPlatform} at: ${outputPath}`);
      console.log(`Files created: ${result.files.join(', ')}`);

      if (targetPlatform === 'gemini') {
        console.log(`\nTo install in Gemini CLI:`);
        console.log(`  gemini extensions install ${path.resolve(outputPath)}`);
      } else {
        console.log(`\nTo use in Claude Code:`);
        console.log(`  Copy to .claude/skills/ or reference directly`);
      }

    } else {
      console.error('Error: Specify --to <platform>, --universal, or --analyze');
      process.exit(1);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

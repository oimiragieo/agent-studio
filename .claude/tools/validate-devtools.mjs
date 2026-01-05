#!/usr/bin/env node
/**
 * DevTools Availability Validator
 * Validates that Chrome DevTools MCP is available and configured correctly
 * for browser testing workflows.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '../..');

const MCP_CONFIG_PATH = path.join(ROOT, '.claude/.mcp.json');

// Required DevTools tools
const REQUIRED_TOOLS = [
  'navigate_page',
  'take_screenshot',
  'click_element',
  'type_text',
  'get_console_logs',
  'get_network_logs',
  'performance_profiling'
];

/**
 * Validate DevTools MCP availability
 */
async function validateDevTools() {
  const issues = [];
  const warnings = [];
  
  try {
    // Check if MCP config exists
    let mcpConfig;
    try {
      const configContent = await fs.readFile(MCP_CONFIG_PATH, 'utf-8');
      mcpConfig = JSON.parse(configContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        issues.push('MCP configuration file not found at .claude/.mcp.json');
        return { available: false, issues, warnings };
      } else {
        issues.push(`Error reading MCP config: ${error.message}`);
        return { available: false, issues, warnings };
      }
    }
    
    // Check for Chrome DevTools MCP server
    const servers = mcpConfig.servers || mcpConfig.mcpServers || {};
    const devtoolsServer = servers['chrome-devtools'] || servers['chrome-devtools-mcp'] || servers['devtools'];
    
    if (!devtoolsServer) {
      issues.push('Chrome DevTools MCP server not found in MCP configuration');
      return { available: false, issues, warnings };
    }
    
    // Check server configuration
    if (!devtoolsServer.command && !devtoolsServer.url) {
      issues.push('Chrome DevTools MCP server missing command or URL configuration');
    }
    
    // Note: We can't actually test tool availability without running the MCP server
    // This validation checks configuration only
    warnings.push('Tool availability cannot be verified without active MCP connection');
    warnings.push('Ensure Chrome DevTools MCP server is running and tools are accessible');
    
    return {
      available: true,
      issues,
      warnings,
      server: devtoolsServer,
      required_tools: REQUIRED_TOOLS
    };
    
  } catch (error) {
    issues.push(`Validation error: ${error.message}`);
    return { available: false, issues, warnings };
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node .claude/tools/validate-devtools.mjs [--json]');
    console.log('');
    console.log('Validates Chrome DevTools MCP availability for browser testing workflows.');
    console.log('');
    console.log('Options:');
    console.log('  --json    Output results as JSON');
    console.log('  --help    Show this help message');
    process.exit(0);
  }
  
  const result = await validateDevTools();
  
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.available ? 0 : 1);
  } else {
    if (result.available) {
      console.log('✅ Chrome DevTools MCP is configured');
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
      console.log(`\n📋 Required tools: ${REQUIRED_TOOLS.join(', ')}`);
      process.exit(0);
    } else {
      console.log('❌ Chrome DevTools MCP is not available');
      console.log('\nIssues:');
      result.issues.forEach(i => console.log(`   - ${i}`));
      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


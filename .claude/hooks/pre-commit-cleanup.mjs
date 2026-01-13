#!/usr/bin/env node
import { TempFileManager } from '../tools/temp-file-manager.mjs';
import { execSync } from 'child_process';

console.log('🧹 Pre-commit: Running automatic cleanup...');

// Clean old temp files
const cleaned = TempFileManager.cleanup(24);
console.log(`   Cleaned ${cleaned} temp files older than 24 hours`);

// Check for temp files in root
try {
  const rootFiles = execSync('git status --short --untracked-files=all', { encoding: 'utf8' });
  const tempInRoot = rootFiles
    .split('\n')
    .filter(line => line.includes('tmpclaude') || line.match(/^\?\? (tmp-|nul$|con$)/));

  if (tempInRoot.length > 0) {
    console.error('❌ ERROR: Temp files found in root:');
    tempInRoot.forEach(f => console.error(`   ${f}`));
    console.error('\n   Run: pnpm cleanup');
    process.exit(1);
  }
} catch (error) {
  // Git not available or not a repo - skip check
}

console.log('✅ Pre-commit: Cleanup complete\n');

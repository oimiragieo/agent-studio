#!/usr/bin/env node
/**
 * typescript-expert - Consolidated Expert Skill
 * Consolidates 1 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
typescript-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  TypeScript and JavaScript expert including type systems, patterns, and tooling

Consolidated from: 1 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ['typescript-expert'].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('typescript-expert skill loaded. Use with Claude for expert guidance.');

#!/usr/bin/env node
/**
 * frontend-expert - Consolidated Expert Skill
 * Consolidates 2 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
frontend-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Frontend development expert including UI/UX patterns, responsive design, and accessibility

Consolidated from: 2 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ['frontend-expert', 'ui-components-expert'].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('frontend-expert skill loaded. Use with Claude for expert guidance.');

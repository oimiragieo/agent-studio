#!/usr/bin/env node
/**
 * nextjs-expert - Consolidated Expert Skill
 * Consolidates 1 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
nextjs-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Next.js framework expert including App Router, Server Components, and API routes

Consolidated from: 1 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ['nextjs-expert'].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('nextjs-expert skill loaded. Use with Claude for expert guidance.');

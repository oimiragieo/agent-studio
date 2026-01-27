#!/usr/bin/env node
/**
 * nodejs-expert - Consolidated Expert Skill
 * Consolidates 1 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
nodejs-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Node.js backend expert including Express, NestJS, and async patterns

Consolidated from: 1 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ['nodejs-expert'].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('nodejs-expert skill loaded. Use with Claude for expert guidance.');

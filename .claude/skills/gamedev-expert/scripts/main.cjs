#!/usr/bin/env node
/**
 * gamedev-expert - Consolidated Expert Skill
 * Consolidates 4 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
gamedev-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Game development expert including DragonRuby, Unity, and game mechanics

Consolidated from: 4 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  [
    'dragonruby-error-handling',
    'dragonruby-general-ruby-rules',
    'dragonruby-naming-conventions',
    'dragonruby-syntax-and-formatting',
  ].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('gamedev-expert skill loaded. Use with Claude for expert guidance.');

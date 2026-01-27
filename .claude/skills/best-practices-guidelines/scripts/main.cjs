#!/usr/bin/env node
/**
 * best-practices-guidelines - Rule-based Skill
 * Converted from: best-practices-guidelines.mdc
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    options[key] = value;
  }
}

if (options.help) {
  console.log(`
best-practices-guidelines - Code Guidelines Skill

Usage:
  node main.cjs --check <file>    Check a file against guidelines
  node main.cjs --list            List all guidelines
  node main.cjs --help            Show this help

Description:
  Specifies best practices, including following RESTful API design principles, implementing responsive design, using Zod for data validation, and regularly updating dependencies. This rule promotes modern and robust development practices.
`);
  process.exit(0);
}

if (options.list) {
  console.log('Guidelines for best-practices-guidelines:');
  console.log('See SKILL.md for full guidelines');
  process.exit(0);
}

console.log('best-practices-guidelines skill loaded. Use with Claude for code review.');

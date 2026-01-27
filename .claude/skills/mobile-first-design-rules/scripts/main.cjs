#!/usr/bin/env node
/**
 * mobile-first-design-rules - Rule-based Skill
 * Converted from: mobile-first-design-rules.mdc
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
mobile-first-design-rules - Code Guidelines Skill

Usage:
  node main.cjs --check <file>    Check a file against guidelines
  node main.cjs --list            List all guidelines
  node main.cjs --help            Show this help

Description:
  Focuses on rules and best practices for mobile-first design and responsive typography using tailwind.
`);
  process.exit(0);
}

if (options.list) {
  console.log('Guidelines for mobile-first-design-rules:');
  console.log('See SKILL.md for full guidelines');
  process.exit(0);
}

console.log('mobile-first-design-rules skill loaded. Use with Claude for code review.');

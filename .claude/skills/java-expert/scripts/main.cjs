#!/usr/bin/env node
/**
 * java-expert - Consolidated Expert Skill
 * Consolidates 1 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
java-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Java and Spring Boot expert including REST APIs, JPA, and microservices

Consolidated from: 1 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  ['java-expert'].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('java-expert skill loaded. Use with Claude for expert guidance.');

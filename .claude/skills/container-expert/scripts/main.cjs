#!/usr/bin/env node
/**
 * container-expert - Consolidated Expert Skill
 * Consolidates 5 individual skills
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`
container-expert - Expert Skill

Usage:
  node main.cjs --list     List consolidated skills
  node main.cjs --help     Show this help

Description:
  Container orchestration expert including Docker, Kubernetes, Helm, and service mesh

Consolidated from: 5 skills
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log('Consolidated skills:');
  [
    'docker-configuration',
    'istio-service-mesh-configuration',
    'istio-specific-rules',
    'knative-service-guidance',
    'knative-specific-rules',
  ].forEach(s => console.log('  - ' + s));
  process.exit(0);
}

console.log('container-expert skill loaded. Use with Claude for expert guidance.');

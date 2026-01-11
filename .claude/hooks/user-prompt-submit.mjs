#!/usr/bin/env node
/**
 * User Prompt Submit Hook (Cross-Platform)
 *
 * Validates user prompts and routes security prompts to security-architect/compliance-auditor
 * Instead of blocking security prompts, routes them to appropriate agents
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read JSON input from stdin
let input;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch (error) {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

const prompt = input.prompt || '';

if (!prompt) {
  console.log(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

// Security keywords that should route to security-architect or compliance-auditor
const SECURITY_KEYWORDS = [
  'security',
  'authentication',
  'authorization',
  'compliance',
  'threat',
  'vulnerability',
  'encryption',
  'zero-trust',
  'audit',
  'penetration test',
  'security review',
  'security audit',
  'compliance check',
  'vulnerability scan',
  'security architecture',
  'security design',
  'security assessment',
];

// Compliance keywords that should route to compliance-auditor
const COMPLIANCE_KEYWORDS = [
  'compliance',
  'audit',
  'regulatory',
  'gdpr',
  'hipaa',
  'sox',
  'pci',
  'compliance audit',
  'regulatory compliance',
  'compliance review',
];

// Jailbreak detection patterns (still block these)
const JAILBREAK_PATTERNS = [
  /ignore previous instructions/i,
  /forget all rules/i,
  /act as if/i,
  /pretend you are/i,
  /system override/i,
  /bypass safety/i,
  /ignore safety guidelines/i,
  /you are now/i,
  /from now on/i,
  /new instructions/i,
  /override system/i,
  /disregard/i,
  /ignore the above/i,
  /forget everything/i,
];

// Check for jailbreak patterns (block these)
for (const pattern of JAILBREAK_PATTERNS) {
  if (pattern.test(prompt)) {
    console.log(
      JSON.stringify({
        decision: 'block',
        reason: `Jailbreak attempt detected: ${pattern}`,
      })
    );
    process.exit(0);
  }
}

// Check for security keywords - ROUTE instead of block
const securityKeywordsFound = SECURITY_KEYWORDS.filter(keyword =>
  new RegExp(`\\b${keyword}\\b`, 'i').test(prompt)
);

const complianceKeywordsFound = COMPLIANCE_KEYWORDS.filter(keyword =>
  new RegExp(`\\b${keyword}\\b`, 'i').test(prompt)
);

if (securityKeywordsFound.length > 0 || complianceKeywordsFound.length > 0) {
  // Route to appropriate agent instead of blocking
  const routeTo = complianceKeywordsFound.length > 0 ? 'compliance-auditor' : 'security-architect';

  console.log(
    JSON.stringify({
      decision: 'route',
      route_to: routeTo,
      reason: `Security/compliance intent detected. Routing to ${routeTo}.`,
      keywords: [...securityKeywordsFound, ...complianceKeywordsFound],
    })
  );
  process.exit(0);
}

// Check prompt length (block extremely long prompts)
if (prompt.length > 50000) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: 'Prompt too long (potential injection attempt)',
    })
  );
  process.exit(0);
}

// Allow by default - write to queue for orchestrator-entry to process
try {
  const queueDir = join(__dirname, '..', 'context', 'queue');
  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }

  const queueFile = join(queueDir, 'incoming-prompt.json');
  const promptData = {
    prompt,
    timestamp: new Date().toISOString(),
    source: 'user-prompt-submit-hook',
  };

  writeFileSync(queueFile, JSON.stringify(promptData, null, 2), 'utf-8');
} catch (error) {
  // If queue write fails, still allow the prompt
  // Silently continue - queue write is best effort
}

// Allow and route to orchestrator-entry
console.log(
  JSON.stringify({
    decision: 'allow',
    route_to: 'orchestrator-entry',
  })
);

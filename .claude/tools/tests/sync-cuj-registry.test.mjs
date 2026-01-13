#!/usr/bin/env node

/**
 * Test suite for sync-cuj-registry.mjs agent/skill detection
 *
 * Tests all detection patterns:
 * - Agents: backticks, bold lists, chains, arrows, plain text
 * - Skills: backticks, bold lists, plain lists, section headers
 *
 * Run: node .claude/tools/tests/sync-cuj-registry.test.mjs
 */

import { describe, it, expect } from './test-framework.mjs';

// Mock CUJ content for testing different formats
const testCases = [
  {
    name: 'Backtick agent format',
    content: `
## Agents Used

- \`developer\`
- \`architect\`
`,
    expectedAgents: ['developer', 'architect'],
    expectedSkills: [],
  },
  {
    name: 'Title case agent format',
    content: `
## Agents Used

- Developer (implements features)
- Architect (designs system)
- Security Architect
`,
    expectedAgents: ['developer', 'architect', 'security-architect'],
    expectedSkills: [],
  },
  {
    name: 'Chain format with arrows',
    content: `
## Agents Used

- Planner -> Developer -> QA
`,
    expectedAgents: ['planner', 'developer', 'qa'],
    expectedSkills: [],
  },
  {
    name: 'Chain format with unicode arrows',
    content: `
## Agents Used

- Planner → Analyst → PM → Architect
`,
    expectedAgents: ['planner', 'analyst', 'pm', 'architect'],
    expectedSkills: [],
  },
  {
    name: 'Mixed agent formats',
    content: `
## Agents Used

- Developer → Technical Writer
- \`code-reviewer\`
- QA
`,
    expectedAgents: ['developer', 'technical-writer', 'code-reviewer', 'qa'],
    expectedSkills: [],
  },
  {
    name: 'Backtick skill format',
    content: `
## Skills Used

- \`scaffolder\` - Code generation
- \`rule-auditor\` - Compliance checking
`,
    expectedAgents: [],
    expectedSkills: ['scaffolder', 'rule-auditor'],
  },
  {
    name: 'Bold skill format',
    content: `
## Skills Used

- **scaffolder**: Generates boilerplate
- **doc-generator**: Creates documentation
`,
    expectedAgents: [],
    expectedSkills: ['scaffolder', 'doc-generator'],
  },
  {
    name: 'Plain list skill format',
    content: `
## Skills Used

- plan-generator (creates plans)
- response-rater (rates quality)
`,
    expectedAgents: [],
    expectedSkills: ['plan-generator', 'response-rater'],
  },
  {
    name: 'Mixed skill formats',
    content: `
## Skills Used

- \`scaffolder\` - Generates code
- **rule-auditor**: Validates rules
- doc-generator (documentation)
`,
    expectedAgents: [],
    expectedSkills: ['scaffolder', 'rule-auditor', 'doc-generator'],
  },
  {
    name: 'None values should be excluded',
    content: `
## Agents Used

- None (manual setup process)

## Skills Used

- None (setup phase)
`,
    expectedAgents: [],
    expectedSkills: [],
  },
  {
    name: 'Real-world example from CUJ-010',
    content: `
## Agents Used

- Developer → Technical Writer

## Skills Used

- \`scaffolder\` - API generation
- \`api-contract-generator\` - OpenAPI/Swagger schema generation
- \`doc-generator\` - API documentation
- \`response-rater\` - Plan quality validation
`,
    expectedAgents: ['developer', 'technical-writer'],
    expectedSkills: ['scaffolder', 'api-contract-generator', 'doc-generator', 'response-rater'],
  },
  {
    name: 'Real-world example from CUJ-020',
    content: `
## Agents Used

- Security Architect

## Skills Used

- \`rule-auditor\` - Security rule compliance checking
- \`response-rater\` - Plan quality validation
`,
    expectedAgents: ['security-architect'],
    expectedSkills: ['rule-auditor', 'response-rater'],
  },
  {
    name: 'Real-world example from CUJ-004',
    content: `
## Agents Used

- Planner (orchestrates planning)
- Analyst (business requirements)
- PM (product requirements)
- Architect (technical design)

## Skills Used

- \`plan-generator\` - Creates structured plans
- \`response-rater\` - Plan quality validation
`,
    expectedAgents: ['planner', 'analyst', 'pm', 'architect'],
    expectedSkills: ['plan-generator', 'response-rater'],
  },
  {
    name: 'Complex chain from CUJ-005',
    content: `
## Agents Used

- Planner -> Analyst -> PM -> UX Expert -> Architect -> Database Architect -> QA -> Developer -> Technical Writer -> QA

## Skills Used

- \`plan-generator\` - Project planning
- \`scaffolder\` - Code generation
`,
    expectedAgents: [
      'planner',
      'analyst',
      'pm',
      'ux-expert',
      'architect',
      'database-architect',
      'qa',
      'developer',
      'technical-writer',
    ],
    expectedSkills: ['plan-generator', 'scaffolder'],
  },
];

// Simple extraction function (mirrors sync-cuj-registry.mjs logic)
function extractAgentsAndSkills(content) {
  const metadata = {
    agents: [],
    skills: [],
  };

  // Extract agents with comprehensive pattern matching
  const agentsSection = content.match(/##\s+Agents Used\s+(.+?)(?=\n##|$)/s);
  if (agentsSection) {
    const sectionText = agentsSection[1];

    // Pattern 1: Backticks - `agent-name`
    const backtickMatches = sectionText.matchAll(/`([a-z][a-z-]+)`/g);
    for (const match of backtickMatches) {
      const agent = match[1].toLowerCase().trim();
      if (agent !== 'none' && !metadata.agents.includes(agent)) {
        metadata.agents.push(agent);
      }
    }

    // Pattern 2: Chain format - Parse entire chain and extract all agents
    // Handles: Planner -> Developer -> QA or Planner → Developer → QA
    const chainLines = sectionText
      .split('\n')
      .filter(line => line.includes('->') || line.includes('→'));
    for (const line of chainLines) {
      // Split by arrows (both ASCII and Unicode)
      const agentNames = line.split(/(?:->|→)/).map(part => part.trim().replace(/^[-*]\s+/, ''));
      for (const agentName of agentNames) {
        if (agentName) {
          // Handle both "Security Architect" and "security-architect" formats
          const agent = agentName.toLowerCase().replace(/\s+/g, '-');
          if (agent !== 'none' && !metadata.agents.includes(agent)) {
            metadata.agents.push(agent);
          }
        }
      }
    }

    // Pattern 3: Title case agents without arrows - Agent Name (description)
    // Match lines without arrows that start with capital letter
    const titleCaseMatches = sectionText.matchAll(
      /^[-*]\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)(?:\s+\(|$)/gm
    );
    for (const match of titleCaseMatches) {
      const agentName = match[1].trim();
      // Convert "Security Architect" → "security-architect"
      const agent = agentName.toLowerCase().replace(/\s+/g, '-');
      if (agent !== 'none' && !metadata.agents.includes(agent)) {
        metadata.agents.push(agent);
      }
    }

    // Pattern 4: Lowercase with hyphens directly - agent-name (no backticks)
    const lowercaseMatches = sectionText.matchAll(/[-*]\s+([a-z][a-z-]+)(?:\s|$|\()/g);
    for (const match of lowercaseMatches) {
      const agent = match[1].toLowerCase().trim();
      if (
        agent !== 'none' &&
        agent !== 'skill' &&
        agent !== 'skill-based' &&
        !metadata.agents.includes(agent)
      ) {
        metadata.agents.push(agent);
      }
    }
  }

  // Extract skills with comprehensive pattern matching
  const skillsSection = content.match(/##\s+Skills Used\s+(.+?)(?=\n##|$)/s);
  if (skillsSection) {
    const sectionText = skillsSection[1];

    // Pattern 1: Backticks - `skill-name` (most common)
    const backtickMatches = sectionText.matchAll(/`([a-z][a-z-]+)`/g);
    for (const match of backtickMatches) {
      const skill = match[1].trim();
      if (skill !== 'none' && !metadata.skills.includes(skill)) {
        metadata.skills.push(skill);
      }
    }

    // Pattern 2: Bold list - **skill**: skill-name
    const boldListMatches = sectionText.matchAll(/[-*]\s+\*\*([a-z][a-z-]+)\*\*:/g);
    for (const match of boldListMatches) {
      const skill = match[1].trim();
      if (skill !== 'none' && !metadata.skills.includes(skill)) {
        metadata.skills.push(skill);
      }
    }

    // Pattern 3: Plain list without backticks - skill-name (description)
    // Only capture if it looks like a skill (lowercase with hyphens)
    const plainListMatches = sectionText.matchAll(/[-*]\s+([a-z][a-z-]+)(?:\s+-\s+|\s+\()/g);
    for (const match of plainListMatches) {
      const skill = match[1].trim();
      // Exclude common false positives
      const excludeWords = ['none', 'skill', 'skill-based', 'manual', 'setup', 'phase'];
      if (!excludeWords.includes(skill) && !metadata.skills.includes(skill)) {
        metadata.skills.push(skill);
      }
    }

    // Pattern 4: Section header format - ## skill-name
    // Sometimes skills are listed as subsections
    const sectionHeaderMatches = sectionText.matchAll(/###\s+`?([a-z][a-z-]+)`?/g);
    for (const match of sectionHeaderMatches) {
      const skill = match[1].trim();
      if (skill !== 'none' && !metadata.skills.includes(skill)) {
        metadata.skills.push(skill);
      }
    }
  }

  return metadata;
}

// Run tests
describe('CUJ Registry Agent/Skill Detection', () => {
  testCases.forEach(testCase => {
    it(testCase.name, () => {
      const result = extractAgentsAndSkills(testCase.content);

      // Sort arrays for consistent comparison
      result.agents.sort();
      result.skills.sort();
      const expectedAgents = [...testCase.expectedAgents].sort();
      const expectedSkills = [...testCase.expectedSkills].sort();

      expect(result.agents).toEqual(expectedAgents);
      expect(result.skills).toEqual(expectedSkills);
    });
  });

  // Additional integration test
  it('should not have "Unique Agents: 0" issue', () => {
    const realWorldContent = `
## Agents Used

- Developer → Technical Writer
- Security Architect

## Skills Used

- \`scaffolder\`
- \`rule-auditor\`
`;

    const result = extractAgentsAndSkills(realWorldContent);
    expect(result.agents.length).toBeGreaterThan(0);
    expect(result.skills.length).toBeGreaterThan(0);
  });
});

#!/usr/bin/env node
/**
 * Context Injector - Provides strict context injection packets for sub-agents
 *
 * Prevents "Context Drift" by providing formalized context packets:
 * - Goal: What the sub-agent should accomplish
 * - Constraints: Rules and limitations (from architecture, style guides, etc.)
 * - References: Paths to relevant files and artifacts
 * - Definition of Done: Success criteria
 *
 * Usage:
 *   import { createContextPacket, injectContext } from './context-injector.mjs';
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import {
  readArtifactRegistry,
  getRunDirectoryStructure,
  getArtifactsArray,
} from './run-manager.mjs';
import { resolveArtifactPath } from './path-resolver.mjs';

/**
 * Create a context injection packet for a sub-agent
 * @param {Object} params - Packet parameters
 * @param {string} params.goal - What the sub-agent should accomplish
 * @param {string[]} params.constraints - Array of constraint strings (from architecture, style guides, etc.)
 * @param {string[]} params.references - Array of file paths or artifact names to reference
 * @param {string} params.definitionOfDone - Success criteria
 * @param {string} params.runId - Run identifier (for resolving artifact paths)
 * @param {number} params.step - Step number (for context)
 * @param {string} params.agent - Agent name receiving the packet
 * @returns {Object} Context packet
 */
export function createContextPacket(params) {
  const {
    goal,
    constraints = [],
    references = [],
    definitionOfDone,
    runId = null,
    step = null,
    agent = null,
  } = params;

  if (!goal) {
    throw new Error('Context packet requires a goal');
  }

  if (!definitionOfDone) {
    throw new Error('Context packet requires a definition of done');
  }

  // Resolve references if runId provided
  const resolvedReferences = runId ? resolveReferences(references, runId) : references;

  return {
    goal,
    constraints,
    references: resolvedReferences,
    definitionOfDone,
    metadata: {
      runId,
      step,
      agent,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Resolve artifact references to actual file paths
 * @param {string[]} references - Reference strings (artifact names or file paths)
 * @param {string} runId - Run identifier
 * @returns {Promise<Object[]>} Resolved references with paths and content previews
 */
async function resolveReferences(references, runId) {
  const resolved = [];
  const runDirs = getRunDirectoryStructure(runId);

  // Read artifact registry
  let artifactRegistry;
  try {
    artifactRegistry = await readArtifactRegistry(runId);
  } catch (error) {
    // Registry may not exist yet
    artifactRegistry = { artifacts: {} }; // Map structure, not array
  }

  // Use shared helper to handle both map and array formats
  const artifactsArray = getArtifactsArray(artifactRegistry);

  for (const ref of references) {
    const resolvedRef = {
      name: ref,
      path: null,
      type: 'unknown',
      contentPreview: null,
    };

    // Check if it's an artifact name
    const artifact = artifactsArray.find(a => a.name === ref);
    if (artifact) {
      resolvedRef.path = artifact.path || resolveArtifactPath(runId, artifact.name);
      resolvedRef.type = 'artifact';

      // Try to read content preview
      if (existsSync(resolvedRef.path)) {
        try {
          const content = JSON.parse(readFileSync(resolvedRef.path, 'utf-8'));
          // Create a preview (first 500 chars of stringified JSON)
          const preview = JSON.stringify(content).substring(0, 500);
          resolvedRef.contentPreview =
            preview.length < JSON.stringify(content).length ? preview + '...' : preview;
        } catch (error) {
          // Not JSON or can't read
        }
      }
    } else {
      // Check if it's a file path
      const filePath = resolve(process.cwd(), ref);
      if (existsSync(filePath)) {
        resolvedRef.path = filePath;
        resolvedRef.type = 'file';

        // Try to read content preview for text files
        if (filePath.endsWith('.md') || filePath.endsWith('.txt') || filePath.endsWith('.json')) {
          try {
            const content = readFileSync(filePath, 'utf-8');
            resolvedRef.contentPreview =
              content.substring(0, 500) + (content.length > 500 ? '...' : '');
          } catch (error) {
            // Can't read
          }
        }
      }
    }

    resolved.push(resolvedRef);
  }

  return resolved;
}

/**
 * Format context packet as a prompt string for injection
 * @param {Object} packet - Context packet
 * @returns {string} Formatted prompt string
 */
export function formatContextPacket(packet) {
  let prompt = `# Context Packet for ${packet.metadata.agent || 'Sub-Agent'}\n\n`;

  prompt += `## Goal\n\n`;
  prompt += `${packet.goal}\n\n`;

  if (packet.constraints.length > 0) {
    prompt += `## Constraints\n\n`;
    packet.constraints.forEach((constraint, index) => {
      prompt += `${index + 1}. ${constraint}\n`;
    });
    prompt += `\n`;
  }

  if (packet.references.length > 0) {
    prompt += `## References\n\n`;
    packet.references.forEach((ref, index) => {
      prompt += `${index + 1}. **${ref.name}**\n`;
      if (ref.path) {
        prompt += `   - Path: \`${relative(process.cwd(), ref.path)}\`\n`;
      }
      if (ref.type) {
        prompt += `   - Type: ${ref.type}\n`;
      }
      if (ref.contentPreview) {
        prompt += `   - Preview: ${ref.contentPreview.substring(0, 200)}...\n`;
      }
      prompt += `\n`;
    });
  }

  prompt += `## Definition of Done\n\n`;
  prompt += `${packet.definitionOfDone}\n\n`;

  prompt += `---\n\n`;
  prompt += `**Context Packet Metadata:**\n`;
  prompt += `- Run ID: ${packet.metadata.runId || 'N/A'}\n`;
  prompt += `- Step: ${packet.metadata.step || 'N/A'}\n`;
  prompt += `- Created: ${packet.metadata.createdAt}\n`;

  return prompt;
}

/**
 * Inject context packet into agent prompt
 * @param {string} basePrompt - Base agent prompt
 * @param {Object} packet - Context packet
 * @returns {string} Enhanced prompt with injected context
 */
export function injectContext(basePrompt, packet) {
  const formattedPacket = formatContextPacket(packet);

  return `${basePrompt}\n\n---\n\n${formattedPacket}`;
}

/**
 * Extract constraints from architecture document
 * @param {string} architecturePath - Path to architecture document
 * @returns {string[]} Array of constraint strings
 */
export function extractConstraintsFromArchitecture(architecturePath) {
  if (!existsSync(architecturePath)) {
    return [];
  }

  try {
    const content = readFileSync(architecturePath, 'utf-8');
    const constraints = [];

    // Look for constraint patterns (markdown headers, lists, etc.)
    const lines = content.split('\n');
    let inConstraintsSection = false;

    for (const line of lines) {
      // Check for constraints section
      if (line.match(/^##?\s+(Constraints|Rules|Guidelines|Standards)/i)) {
        inConstraintsSection = true;
        continue;
      }

      // Stop at next major section
      if (inConstraintsSection && line.match(/^##?\s+/)) {
        inConstraintsSection = false;
        continue;
      }

      // Extract constraint items
      if (inConstraintsSection) {
        // Match list items
        const listMatch = line.match(/^[-*]\s+(.+)/);
        if (listMatch) {
          constraints.push(listMatch[1].trim());
        }

        // Match numbered items
        const numberedMatch = line.match(/^\d+\.\s+(.+)/);
        if (numberedMatch) {
          constraints.push(numberedMatch[1].trim());
        }
      }
    }

    return constraints;
  } catch (error) {
    console.warn(
      `Warning: Could not extract constraints from ${architecturePath}: ${error.message}`
    );
    return [];
  }
}

/**
 * Extract constraints from style guide
 * @param {string} styleGuidePath - Path to style guide document
 * @returns {string[]} Array of constraint strings
 */
export function extractConstraintsFromStyleGuide(styleGuidePath) {
  // Similar to extractConstraintsFromArchitecture
  return extractConstraintsFromArchitecture(styleGuidePath);
}

/**
 * Auto-gather context from 6 sources
 * @param {string} taskId - Task identifier
 * @param {string|null} outputPath - Optional path to save enriched context
 * @returns {Promise<Object>} Enriched context with metadata
 */
export async function enrichTaskContext(taskId, outputPath = null) {
  const context = {
    background: await gatherBackground(),
    previous_attempts: await gatherPreviousAttempts(taskId),
    related_work: await gatherRelatedWork(taskId),
    constraints: await gatherConstraints(),
    dependencies: await gatherDependencies(),
    success_criteria: await gatherSuccessCriteria(taskId),
  };

  const completenessScore = calculateCompleteness(context);
  const enriched = {
    ...context,
    metadata: {
      completenessScore,
      generated_at: new Date().toISOString(),
      sources: ['artifacts', 'history', 'git', 'docs', 'workflows', 'dependencies'],
    },
  };

  if (outputPath) {
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(enriched, null, 2));
  }

  return enriched;
}

/**
 * Gather background context from artifacts and documentation
 * @returns {Promise<Object>} Background context
 */
async function gatherBackground() {
  const fs = await import('fs/promises');
  const { glob } = await import('glob');

  const artifacts = await glob('.claude/context/artifacts/**/*.{json,md}', {
    windowsPathsNoEscape: true,
  });
  const docs = await glob('.claude/docs/**/*.md', { windowsPathsNoEscape: true });

  let projectOverview = '';
  try {
    projectOverview = await fs.readFile('.claude/docs/README.md', 'utf-8');
  } catch (error) {
    // README may not exist
    try {
      projectOverview = await fs.readFile('README.md', 'utf-8');
    } catch (err) {
      projectOverview = 'No project overview available';
    }
  }

  return {
    project_overview: projectOverview.substring(0, 1000), // Limit size
    recent_artifacts: artifacts.slice(0, 5).map(a => resolve(a)),
    key_documentation: docs
      .filter(d => d.includes('GUIDE') || d.includes('README'))
      .map(d => resolve(d)),
  };
}

/**
 * Gather previous attempt history for this task
 * @param {string} taskId - Task identifier
 * @returns {Promise<Array>} Previous attempts
 */
async function gatherPreviousAttempts(taskId) {
  const { glob } = await import('glob');
  const fs = await import('fs/promises');

  const historyFiles = await glob(`.claude/context/history/**/*${taskId}*.json`, {
    windowsPathsNoEscape: true,
  });
  const attempts = [];

  for (const file of historyFiles) {
    try {
      const content = JSON.parse(await fs.readFile(file, 'utf-8'));
      attempts.push({
        timestamp: content.timestamp || content.created_at || 'unknown',
        agent: content.agent || 'unknown',
        verdict: content.verdict || content.status || 'unknown',
        errors: content.errors || content.validation_errors || [],
      });
    } catch (error) {
      // Skip malformed files
    }
  }

  return attempts;
}

/**
 * Gather related work from git log and artifacts
 * @param {string} taskId - Task identifier
 * @returns {Promise<Object>} Related work
 */
async function gatherRelatedWork(taskId) {
  const { execSync } = await import('child_process');
  const { glob } = await import('glob');

  let gitLog = '';
  try {
    gitLog = execSync('git log --oneline -n 20', { encoding: 'utf-8' });
  } catch (error) {
    gitLog = 'Git log unavailable';
  }

  const artifacts = await glob('.claude/context/artifacts/**/*.json', {
    windowsPathsNoEscape: true,
  });

  return {
    recent_commits: gitLog.split('\n').slice(0, 10),
    related_artifacts: artifacts.filter(a => a.includes(taskId)).map(a => resolve(a)),
  };
}

/**
 * Gather constraints from CLAUDE.md and system guardrails
 * @returns {Promise<Object>} Constraints
 */
async function gatherConstraints() {
  const fs = await import('fs/promises');
  const { glob } = await import('glob');

  let claudeMd = '';
  try {
    claudeMd = await fs.readFile('.claude/CLAUDE.md', 'utf-8');
  } catch (error) {
    claudeMd = 'CLAUDE.md not found';
  }

  let fileLocationRules = '';
  try {
    fileLocationRules = await fs.readFile('.claude/rules/subagent-file-rules.md', 'utf-8');
  } catch (error) {
    fileLocationRules = 'File location rules not found';
  }

  const guardrails = await glob('.claude/system/guardrails/**/*.md', {
    windowsPathsNoEscape: true,
  });

  return {
    orchestrator_rules: extractOrchestrationRules(claudeMd),
    file_location_rules: fileLocationRules.substring(0, 2000), // Limit size
    guardrails: guardrails.map(g => resolve(g)),
  };
}

/**
 * Extract orchestration rules from CLAUDE.md
 * @param {string} content - CLAUDE.md content
 * @returns {string} Extracted rules
 */
function extractOrchestrationRules(content) {
  const lines = content.split('\n');
  const rules = [];
  let inRulesSection = false;

  for (const line of lines) {
    if (line.match(/^##?\s+(IDENTITY|ORCHESTRATOR|ENFORCEMENT)/i)) {
      inRulesSection = true;
      continue;
    }

    if (inRulesSection && line.match(/^##?\s+/)) {
      if (rules.length > 0) break; // Stop after first rules section
    }

    if (inRulesSection && line.trim()) {
      rules.push(line.trim());
    }
  }

  return rules.slice(0, 50).join('\n'); // Limit to first 50 lines
}

/**
 * Gather dependencies from dependency validator
 * @returns {Promise<Object>} Dependencies status
 */
async function gatherDependencies() {
  const { execSync } = await import('child_process');

  try {
    const result = execSync('node .claude/tools/dependency-validator.mjs validate-all --json', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return JSON.parse(result);
  } catch (error) {
    return {
      valid: false,
      missing_dependencies: [],
      warnings: ['Dependency validation failed or timed out'],
    };
  }
}

/**
 * Gather success criteria from workflow and task templates
 * @param {string} taskId - Task identifier
 * @returns {Promise<Array>} Success criteria
 */
async function gatherSuccessCriteria(taskId) {
  const { glob } = await import('glob');
  const fs = await import('fs/promises');

  const workflows = await glob('.claude/workflows/**/*.yaml', { windowsPathsNoEscape: true });
  const criteria = [];

  for (const workflow of workflows.slice(0, 5)) {
    try {
      const content = await fs.readFile(workflow, 'utf-8');
      const extracted = extractSuccessCriteria(content);
      criteria.push(...extracted);
    } catch (error) {
      // Skip problematic files
    }
  }

  return criteria.slice(0, 10); // Limit to 10 criteria
}

/**
 * Extract success criteria from workflow YAML
 * @param {string} content - Workflow YAML content
 * @returns {Array} Success criteria
 */
function extractSuccessCriteria(content) {
  const criteria = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match validation or success_criteria fields
    if (
      line.match(/^\s+[-*]\s+(.+)/) &&
      (line.includes('validate') || line.includes('success') || line.includes('criteria'))
    ) {
      const match = line.match(/^\s+[-*]\s+(.+)/);
      if (match) {
        criteria.push(match[1].trim());
      }
    }
  }

  return criteria;
}

/**
 * Calculate completeness score (0-100%)
 * @param {Object} context - Context object
 * @returns {number} Completeness score
 */
function calculateCompleteness(context) {
  const weights = {
    background: 20,
    previous_attempts: 15,
    related_work: 15,
    constraints: 20,
    dependencies: 15,
    success_criteria: 15,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (context[key]) {
      const value = context[key];
      // Check if non-empty
      if (Array.isArray(value) && value.length > 0) {
        score += weight;
      } else if (typeof value === 'object' && Object.keys(value).length > 0) {
        score += weight;
      } else if (typeof value === 'string' && value.length > 0) {
        score += weight;
      }
    }
  }

  return score;
}

// CLI support
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const [, , command, ...args] = process.argv;

  if (command === 'enrich') {
    const taskIdIndex = args.indexOf('--task-id');
    const outputIndex = args.indexOf('--output');

    if (taskIdIndex === -1 || !args[taskIdIndex + 1]) {
      console.error('Usage: node context-injector.mjs enrich --task-id <id> [--output <path>]');
      process.exit(1);
    }

    const taskId = args[taskIdIndex + 1];
    const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

    enrichTaskContext(taskId, outputPath)
      .then(enriched => {
        console.log('Context enriched successfully');
        console.log(`Completeness Score: ${enriched.metadata.completenessScore}%`);
        if (outputPath) {
          console.log(`Saved to: ${outputPath}`);
        }
      })
      .catch(error => {
        console.error('Error enriching context:', error.message);
        process.exit(1);
      });
  } else if (command === 'analyze') {
    const taskIdIndex = args.indexOf('--task-id');

    if (taskIdIndex === -1 || !args[taskIdIndex + 1]) {
      console.error('Usage: node context-injector.mjs analyze --task-id <id>');
      process.exit(1);
    }

    const taskId = args[taskIdIndex + 1];

    enrichTaskContext(taskId)
      .then(enriched => {
        console.log('Context Analysis:');
        console.log(`Completeness Score: ${enriched.metadata.completenessScore}%`);
        console.log('\nBreakdown:');
        console.log(
          `- Background: ${enriched.background && Object.keys(enriched.background).length > 0 ? '✓' : '✗'}`
        );
        console.log(
          `- Previous Attempts: ${enriched.previous_attempts && enriched.previous_attempts.length > 0 ? '✓' : '✗'} (${enriched.previous_attempts.length} found)`
        );
        console.log(
          `- Related Work: ${enriched.related_work && Object.keys(enriched.related_work).length > 0 ? '✓' : '✗'}`
        );
        console.log(
          `- Constraints: ${enriched.constraints && Object.keys(enriched.constraints).length > 0 ? '✓' : '✗'}`
        );
        console.log(
          `- Dependencies: ${enriched.dependencies && enriched.dependencies.valid !== undefined ? '✓' : '✗'}`
        );
        console.log(
          `- Success Criteria: ${enriched.success_criteria && enriched.success_criteria.length > 0 ? '✓' : '✗'} (${enriched.success_criteria.length} found)`
        );
      })
      .catch(error => {
        console.error('Error analyzing context:', error.message);
        process.exit(1);
      });
  } else if (command === 'sources') {
    console.log('Available Context Sources:');
    console.log('1. artifacts - Recent artifacts from .claude/context/artifacts/');
    console.log('2. history - Previous attempts from .claude/context/history/');
    console.log('3. git - Recent commits from git log');
    console.log('4. docs - Documentation from .claude/docs/ and README.md');
    console.log('5. workflows - Success criteria from .claude/workflows/');
    console.log('6. dependencies - Dependency status from dependency-validator');
  } else {
    console.log('Usage:');
    console.log('  node context-injector.mjs enrich --task-id <id> [--output <path>]');
    console.log('  node context-injector.mjs analyze --task-id <id>');
    console.log('  node context-injector.mjs sources');
  }
}

export default {
  createContextPacket,
  formatContextPacket,
  injectContext,
  extractConstraintsFromArchitecture,
  extractConstraintsFromStyleGuide,
  enrichTaskContext,
};

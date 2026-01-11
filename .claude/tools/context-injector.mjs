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

export default {
  createContextPacket,
  formatContextPacket,
  injectContext,
  extractConstraintsFromArchitecture,
  extractConstraintsFromStyleGuide,
};

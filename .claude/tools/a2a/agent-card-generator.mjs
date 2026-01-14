/**
 * AgentCard Generator
 *
 * Generates A2A v0.3.0 compliant AgentCards from agent definition files.
 * Supports feature flag gating, caching, and comprehensive skill extraction.
 *
 * @module agent-card-generator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isEnabled } from '../feature-flags-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for generated AgentCards (5 minute TTL)
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

/**
 * Parse agent definition from markdown file
 * @param {string} filePath - Path to agent definition file
 * @returns {Object} Parsed agent definition
 */
export function parseAgentDefinition(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent definition file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Extract YAML frontmatter
  let frontmatterStart = -1;
  let frontmatterEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (frontmatterStart === -1) {
        frontmatterStart = i;
      } else {
        frontmatterEnd = i;
        break;
      }
    }
  }

  if (frontmatterStart === -1 || frontmatterEnd === -1) {
    throw new Error(`Invalid agent definition format (missing YAML frontmatter): ${filePath}`);
  }

  // Parse YAML frontmatter (simple parser for our specific format)
  const frontmatter = {};
  const frontmatterLines = lines.slice(frontmatterStart + 1, frontmatterEnd);

  for (const line of frontmatterLines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Handle arrays (tools, context_files)
      if (value.includes(',')) {
        frontmatter[key] = value.split(',').map(v => v.trim());
      } else {
        frontmatter[key] = value.trim();
      }
    }
  }

  // Extract markdown content
  const markdownContent = lines.slice(frontmatterEnd + 1).join('\n');

  // Extract goal and backstory sections
  const goalMatch = markdownContent.match(/<goal>([\s\S]*?)<\/goal>/);
  const backstoryMatch = markdownContent.match(/<backstory>([\s\S]*?)<\/backstory>/);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tools: frontmatter.tools || [],
    model: frontmatter.model || 'sonnet',
    temperature: parseFloat(frontmatter.temperature) || 0.3,
    priority: frontmatter.priority || 'medium',
    context_files: frontmatter.context_files || [],
    goal: goalMatch ? goalMatch[1].trim() : '',
    backstory: backstoryMatch ? backstoryMatch[1].trim() : '',
    capabilities: extractCapabilities(frontmatter, markdownContent),
    version: '1.0.0' // Default version
  };
}

/**
 * Extract capabilities from agent definition
 * @param {Object} frontmatter - Agent frontmatter
 * @param {string} markdownContent - Markdown content
 * @returns {Object} Capabilities object
 */
function extractCapabilities(frontmatter, markdownContent) {
  // Default capabilities for A2A v0.3.0
  return {
    streaming: false,
    push_notifications: false,
    state_transition_history: true,
    extensions: []
  };
}

/**
 * Extract skills from agent definition
 * @param {Object} agentDef - Parsed agent definition
 * @returns {Array} Array of skill objects
 */
export function extractSkills(agentDef) {
  const skills = [];

  // Map agent description to primary skill
  if (agentDef.description) {
    const primarySkill = {
      id: `${agentDef.name}-primary`,
      name: `${agentDef.name} Core Capability`,
      description: agentDef.description,
      tags: [agentDef.name, agentDef.priority],
      examples: [agentDef.goal || agentDef.description],
      inputModes: ['text'],
      outputModes: ['text', 'data']
    };
    skills.push(primarySkill);
  }

  // Extract tool-based skills
  if (agentDef.tools && Array.isArray(agentDef.tools)) {
    const toolSkills = agentDef.tools
      .filter(tool => !tool.startsWith('MCP_')) // Filter out MCP tools for now
      .map((tool, idx) => ({
        id: `${agentDef.name}-tool-${idx}`,
        name: `${tool} Capability`,
        description: `Use ${tool} tool for ${agentDef.name} tasks`,
        tags: [tool.toLowerCase(), agentDef.name],
        examples: [`Use ${tool} to accomplish ${agentDef.name} objectives`],
        inputModes: ['text'],
        outputModes: tool === 'Write' || tool === 'Edit' ? ['file', 'text'] : ['text']
      }));

    skills.push(...toolSkills);
  }

  return skills;
}

/**
 * Generate AgentCard from agent definition
 * @param {Object} agentDef - Parsed agent definition
 * @param {Object} options - Generation options
 * @returns {Object} A2A v0.3.0 compliant AgentCard
 */
export function generateAgentCard(agentDef, options = {}) {
  const baseUrl = options.baseUrl || 'http://localhost:3000';
  const protocolVersion = options.protocolVersion || '0.3.0';

  // Extract skills
  const skills = extractSkills(agentDef);

  // Build AgentCard
  const agentCard = {
    protocol_version: protocolVersion,
    name: agentDef.name,
    description: agentDef.description,
    version: agentDef.version,
    url: `${baseUrl}/agents/${agentDef.name}`,
    supported_interfaces: ['a2a'],
    capabilities: agentDef.capabilities,
    default_input_modes: ['text', 'data'],
    default_output_modes: ['text', 'data', 'file'],
    skills: skills
  };

  // Add optional fields
  if (options.includeProvider !== false) {
    agentCard.provider = {
      organization: 'LLM-Rules System',
      url: baseUrl
    };
  }

  if (options.includeAuthentication) {
    agentCard.authentication = {
      schemes: [
        {
          type: 'http',
          scheme: 'Bearer',
          bearer_format: 'JWT'
        }
      ]
    };
  }

  return agentCard;
}

/**
 * Generate AgentCards for all agents
 * @param {Object} options - Generation options
 * @returns {Array} Array of AgentCards
 */
export function generateAllAgentCards(options = {}) {
  const startTime = Date.now();

  // Check cache
  const cacheKey = 'all-agent-cards';
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.cards;
  }

  // Find all agent definition files
  const agentsDir = path.join(__dirname, '..', '..', 'agents');
  const agentFiles = fs.readdirSync(agentsDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(agentsDir, file));

  const agentCards = [];
  const errors = [];

  for (const filePath of agentFiles) {
    try {
      const agentDef = parseAgentDefinition(filePath);
      const agentCard = generateAgentCard(agentDef, options);
      agentCards.push(agentCard);
    } catch (error) {
      errors.push({ file: filePath, error: error.message });
    }
  }

  const generationTime = Date.now() - startTime;

  // Cache results
  cache.set(cacheKey, {
    cards: agentCards,
    timestamp: Date.now(),
    generationTime,
    errors
  });

  if (errors.length > 0) {
    console.warn(`AgentCard generation completed with ${errors.length} errors:`, errors);
  }

  return agentCards;
}

/**
 * Generate AgentCard with feature flag check
 * @param {string} agentName - Name of the agent
 * @param {Object} options - Generation options
 * @returns {Object|null} AgentCard or null if feature disabled
 */
export function generateAgentCardIfEnabled(agentName, options = {}) {
  const env = options.env || process.env.NODE_ENV || 'dev';

  // Check feature flag
  if (!isEnabled('agent_card_generation', env)) {
    console.warn('agent_card_generation feature flag is disabled');
    return null;
  }

  // Check cache
  const cacheKey = `agent-${agentName}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.card;
  }

  // Find agent file
  const agentsDir = path.join(__dirname, '..', '..', 'agents');
  const agentFile = path.join(agentsDir, `${agentName}.md`);

  if (!fs.existsSync(agentFile)) {
    throw new Error(`Agent not found: ${agentName}`);
  }

  // Parse and generate
  const startTime = Date.now();
  const agentDef = parseAgentDefinition(agentFile);
  const agentCard = generateAgentCard(agentDef, options);
  const generationTime = Date.now() - startTime;

  // Cache result
  cache.set(cacheKey, {
    card: agentCard,
    timestamp: Date.now(),
    generationTime
  });

  return agentCard;
}

/**
 * Clear AgentCard cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  const entries = Array.from(cache.entries());
  const now = Date.now();

  return {
    size: cache.size,
    entries: entries.map(([key, value]) => ({
      key,
      age_ms: now - value.timestamp,
      expired: (now - value.timestamp) >= CACHE_TTL_MS
    })),
    ttl_ms: CACHE_TTL_MS
  };
}

export default {
  parseAgentDefinition,
  extractSkills,
  generateAgentCard,
  generateAllAgentCards,
  generateAgentCardIfEnabled,
  clearCache,
  getCacheStats
};

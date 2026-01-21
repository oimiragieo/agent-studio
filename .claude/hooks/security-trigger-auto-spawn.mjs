#!/usr/bin/env node
/**
 * Security Trigger Auto-Spawn Hook (PostToolUse)
 *
 * Monitors Task tool calls for security-related keywords and suggests
 * spawning security-architect agent when security triggers are detected.
 *
 * This is a SUGGESTION system, not a blocking system. It provides
 * informational warnings to help orchestrators remember to include
 * security review when needed.
 *
 * Trigger Source: .claude/context/config/security-triggers-v2.json
 * - 12 security categories
 * - 136+ keywords
 * - Priority-based escalation (critical, high, medium, low)
 */

import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SECURITY_TRIGGERS_PATH = join(
  __dirname,
  '..',
  'context',
  'config',
  'security-triggers-v2.json'
);

// Fallback to legacy location if new location doesn't exist
const SECURITY_TRIGGERS_LEGACY_PATH = join(__dirname, '..', 'tools', 'security-triggers-v2.json');

let responded = false;
function safeRespond(obj) {
  if (responded) return;
  responded = true;
  try {
    process.stdout.write(JSON.stringify(obj));
  } catch {
    // Fail-open: do nothing.
  }
}

// Timeout protection - force exit after 2 seconds (fail-open)
const timeout = setTimeout(() => {
  safeRespond({ decision: 'approve', warning: 'Hook timeout' });
  process.exit(0);
}, 2000);

/**
 * Load security triggers configuration
 */
async function loadSecurityTriggers() {
  try {
    const configPath = existsSync(SECURITY_TRIGGERS_PATH)
      ? SECURITY_TRIGGERS_PATH
      : SECURITY_TRIGGERS_LEGACY_PATH;

    if (!existsSync(configPath)) {
      return null;
    }

    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract text content from tool input for analysis
 */
function extractTextFromToolInput(toolInput) {
  const textParts = [];

  // Extract from common Task tool fields
  if (toolInput.prompt) textParts.push(String(toolInput.prompt));
  if (toolInput.objective) textParts.push(String(toolInput.objective));
  if (toolInput.task) textParts.push(String(toolInput.task));
  if (toolInput.description) textParts.push(String(toolInput.description));

  // Extract from context object
  if (toolInput.context) {
    if (typeof toolInput.context === 'string') {
      textParts.push(toolInput.context);
    } else if (typeof toolInput.context === 'object') {
      const ctx = toolInput.context;
      if (ctx.problem) textParts.push(String(ctx.problem));
      if (ctx.why_now) textParts.push(String(ctx.why_now));
      if (ctx.requirements) textParts.push(String(ctx.requirements));
    }
  }

  // Extract from deliverables array
  if (Array.isArray(toolInput.deliverables)) {
    for (const deliverable of toolInput.deliverables) {
      if (deliverable.description) textParts.push(String(deliverable.description));
      if (deliverable.path) textParts.push(String(deliverable.path));
      if (deliverable.validation) textParts.push(String(deliverable.validation));
    }
  }

  // Extract from success_criteria array
  if (Array.isArray(toolInput.success_criteria)) {
    for (const criterion of toolInput.success_criteria) {
      textParts.push(String(criterion));
    }
  }

  return textParts.join(' ').toLowerCase();
}

/**
 * Detect security triggers in text
 */
function detectSecurityTriggers(text, securityConfig) {
  if (!securityConfig?.categories) return { detected: false, triggers: [] };

  const triggers = [];

  for (const [categoryName, categoryData] of Object.entries(securityConfig.categories)) {
    const keywords = categoryData.keywords || [];
    const matchedKeywords = [];

    for (const keyword of keywords) {
      // Use word boundary matching to avoid false positives
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
      if (regex.test(text)) {
        matchedKeywords.push(keyword);
      }
    }

    if (matchedKeywords.length > 0) {
      triggers.push({
        category: categoryName,
        priority: categoryData.priority || 'medium',
        keywords: matchedKeywords,
        description: categoryData.description,
        required_agents: categoryData.required_agents || [],
        recommended_agents: categoryData.recommended_agents || [],
      });
    }
  }

  return {
    detected: triggers.length > 0,
    triggers,
  };
}

/**
 * Check if security-architect is already included in the task
 */
function isSecurityArchitectIncluded(toolInput) {
  const agentFields = [toolInput.assigned_agent, toolInput.agent, toolInput.subagent_type];

  for (const field of agentFields) {
    if (typeof field === 'string' && field.toLowerCase().includes('security')) {
      return true;
    }
  }

  // Check if security-architect is in required agents list
  if (Array.isArray(toolInput.required_agents)) {
    return toolInput.required_agents.some(
      agent => typeof agent === 'string' && agent.toLowerCase().includes('security')
    );
  }

  return false;
}

/**
 * Format suggestion message
 */
function formatSuggestion(triggers) {
  const highestPriority = triggers.reduce((max, t) => {
    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
    const currentPriority = priorities[t.priority] || 0;
    const maxPriority = priorities[max] || 0;
    return currentPriority > maxPriority ? t.priority : max;
  }, 'low');

  const categories = [...new Set(triggers.map(t => t.category))];
  const allKeywords = triggers.flatMap(t => t.keywords);
  const uniqueKeywords = [...new Set(allKeywords)];

  const requiredAgents = [...new Set(triggers.flatMap(t => t.required_agents || []))];

  const recommendedAgents = [...new Set(triggers.flatMap(t => t.recommended_agents || []))];

  let suggestion = `\n╔═══════════════════════════════════════════════════════════════════╗\n`;
  suggestion += `║  SECURITY TRIGGERS DETECTED (${triggers.length} trigger${triggers.length !== 1 ? 's' : ''})                     ║\n`;
  suggestion += `╠═══════════════════════════════════════════════════════════════════╣\n`;
  suggestion += `║  Priority: ${highestPriority.toUpperCase().padEnd(57)}║\n`;
  suggestion += `║  Categories: ${categories.slice(0, 3).join(', ').substring(0, 53).padEnd(53)}║\n`;

  if (categories.length > 3) {
    suggestion += `║              ${categories.slice(3).join(', ').substring(0, 53).padEnd(53)}║\n`;
  }

  suggestion += `║  Keywords: ${uniqueKeywords.slice(0, 5).join(', ').substring(0, 55).padEnd(55)}║\n`;

  if (uniqueKeywords.length > 5) {
    suggestion += `║            ${`(+${uniqueKeywords.length - 5} more)`.padEnd(57)}║\n`;
  }

  suggestion += `╠═══════════════════════════════════════════════════════════════════╣\n`;
  suggestion += `║  RECOMMENDED ACTION:                                              ║\n`;

  if (requiredAgents.length > 0) {
    suggestion += `║  Include these agents: ${requiredAgents.join(', ').substring(0, 42).padEnd(42)}║\n`;
  }

  if (recommendedAgents.length > 0 && recommendedAgents.length <= 3) {
    suggestion += `║  Also consider: ${recommendedAgents.join(', ').substring(0, 49).padEnd(49)}║\n`;
  }

  if (highestPriority === 'critical') {
    suggestion += `║                                                                   ║\n`;
    suggestion += `║  ⚠️  CRITICAL PRIORITY - Security review is ESSENTIAL           ║\n`;
  } else if (highestPriority === 'high') {
    suggestion += `║                                                                   ║\n`;
    suggestion += `║  ⚠️  HIGH PRIORITY - Security review strongly recommended       ║\n`;
  }

  suggestion += `╚═══════════════════════════════════════════════════════════════════╝\n`;

  return suggestion;
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = Buffer.concat(chunks).toString('utf-8');

  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    safeRespond({ decision: 'approve' });
    return;
  }

  const tool = hookInput.tool_name || hookInput.tool;
  const toolInput = hookInput.tool_input || {};

  // Only monitor Task tool calls
  if (tool !== 'Task') {
    safeRespond({ decision: 'approve' });
    return;
  }

  // Load security triggers configuration
  const securityConfig = await loadSecurityTriggers();
  if (!securityConfig) {
    // Fail-open if config not found
    safeRespond({ decision: 'approve' });
    return;
  }

  // Extract text content from task
  const taskText = extractTextFromToolInput(toolInput);

  // Detect security triggers
  const { detected, triggers } = detectSecurityTriggers(taskText, securityConfig);

  if (!detected) {
    // No security triggers detected
    safeRespond({ decision: 'approve' });
    return;
  }

  // Check if security-architect is already included
  const securityIncluded = isSecurityArchitectIncluded(toolInput);

  if (securityIncluded) {
    // Security already covered - allow without suggestion
    safeRespond({
      decision: 'approve',
      suggestion: null,
      metadata: {
        security_triggers_detected: triggers.length,
        security_covered: true,
        categories: [...new Set(triggers.map(t => t.category))],
        recommended_agents: [...new Set(triggers.flatMap(t => t.required_agents || []))],
      },
    });
    return;
  }

  // Security triggers detected, but security-architect NOT included
  // Provide suggestion (non-blocking)
  const suggestion = formatSuggestion(triggers);

  safeRespond({
    decision: 'approve',
    suggestion,
    metadata: {
      security_triggers_detected: triggers.length,
      categories: [...new Set(triggers.map(t => t.category))],
      highest_priority: triggers.reduce((max, t) => {
        const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
        const currentPriority = priorities[t.priority] || 0;
        const maxPriority = priorities[max] || 0;
        return currentPriority > maxPriority ? t.priority : max;
      }, 'low'),
      recommended_agents: [...new Set(triggers.flatMap(t => t.required_agents || []))],
    },
  });
}

main()
  .catch(error => {
    safeRespond({ decision: 'approve', warning: `Hook error: ${error.message}` });
  })
  .finally(() => {
    clearTimeout(timeout);
  });

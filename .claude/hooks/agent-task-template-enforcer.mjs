#!/usr/bin/env node
/**
 * Agent Task Template Enforcer Hook (PreToolUse)
 *
 * PURPOSE: Blocks Task tool calls that don't use agent-task.schema.json template format.
 *
 * CRITICAL P0 ISSUE: Session analysis showed 0% template compliance causing:
 * - 30-60% reliability loss (missing validation_schema, examples, reasoning_style)
 * - 25-35% more hallucinations (no uncertainty_permission, thinking_budget)
 * - Inconsistent agent outputs (no output_format structure)
 *
 * ENFORCEMENT: Blocks Task calls with:
 * - Freeform text prompts ("create file", "implement feature")
 * - Partial JSON (missing required fields)
 * - Invalid JSON (syntax errors)
 *
 * ALLOWS: Task calls with valid JSON template containing all required fields from agent-task.schema.json v2.1.0
 *
 * @see .claude/schemas/agent-task.schema.json
 * @see .claude/templates/agent-task-template.json
 * @see .claude/docs/AGENT_TASK_TEMPLATE_GUIDE.md
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Required fields from agent-task.schema.json v2.1.0
 */
const REQUIRED_FIELDS = [
  'task_id',
  'objective',
  'context',
  'deliverables',
  'constraints',
  'success_criteria',
  'verification',
  'assigned_agent',
];

/**
 * Required nested fields
 */
const REQUIRED_CONTEXT_FIELDS = ['problem', 'why_now'];
const REQUIRED_VERIFICATION_FIELDS = [
  'verification_type',
  'required_tests',
  'passing_criteria',
  'evidence_required',
];

/**
 * Optimization fields that improve reliability (from research)
 */
const OPTIMIZATION_FIELDS = [
  'reasoning_style',
  'examples',
  'uncertainty_permission',
  'output_format',
  'thinking_budget',
];

/**
 * Read hook input from stdin
 */
function readInput() {
  const chunks = [];
  process.stdin.setEncoding('utf8');

  return new Promise(resolve => {
    process.stdin.on('data', chunk => chunks.push(chunk));
    process.stdin.on('end', () => {
      const input = chunks.join('');
      if (!input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (error) {
        resolve({ error: `Invalid JSON input: ${error.message}` });
      }
    });
  });
}

/**
 * Extract Task prompt from tool_input
 */
function extractTaskPrompt(toolInput) {
  // Handle null/undefined
  if (!toolInput) {
    return '';
  }

  // Task tool input structure varies, check common patterns
  if (typeof toolInput === 'string') {
    return toolInput;
  }

  if (toolInput.prompt) {
    return toolInput.prompt;
  }

  if (toolInput.task) {
    return toolInput.task;
  }

  if (toolInput.instruction) {
    return toolInput.instruction;
  }

  // Return stringified version if none of the above
  return JSON.stringify(toolInput);
}

/**
 * Validate that Task call uses proper JSON template format
 */
function validateTaskTemplate(toolInput) {
  const prompt = extractTaskPrompt(toolInput);

  // Try to parse as JSON
  let taskData;
  try {
    taskData = typeof prompt === 'string' ? JSON.parse(prompt) : prompt;
  } catch (error) {
    return {
      valid: false,
      reason: 'Task prompt is not valid JSON',
      missingFields: REQUIRED_FIELDS,
      error: error.message,
    };
  }

  // Check for required fields
  const missingFields = REQUIRED_FIELDS.filter(field => !(field in taskData));

  if (missingFields.length > 0) {
    return {
      valid: false,
      reason: 'Missing required fields from agent-task.schema.json',
      missingFields,
    };
  }

  // Check nested required fields in context
  if (taskData.context) {
    const missingContextFields = REQUIRED_CONTEXT_FIELDS.filter(
      field => !(field in taskData.context)
    );

    if (missingContextFields.length > 0) {
      return {
        valid: false,
        reason: 'Missing required context fields',
        missingFields: missingContextFields.map(f => `context.${f}`),
      };
    }
  }

  // Check nested required fields in verification (v2.1.0+)
  if (taskData.verification) {
    const missingVerificationFields = REQUIRED_VERIFICATION_FIELDS.filter(
      field => !(field in taskData.verification)
    );

    if (missingVerificationFields.length > 0) {
      return {
        valid: false,
        reason: 'Missing required verification fields (v2.1.0+)',
        missingFields: missingVerificationFields.map(f => `verification.${f}`),
      };
    }
  }

  // Check for optimization fields (warning, not blocking)
  const missingOptimizations = OPTIMIZATION_FIELDS.filter(field => !(field in taskData));

  return {
    valid: true,
    missingOptimizations,
    hasOptimizations: missingOptimizations.length === 0,
  };
}

/**
 * Generate helpful error message with template example
 */
function generateBlockMessage(validationResult) {
  const { reason, missingFields, missingOptimizations } = validationResult;

  let message = `
╔══════════════════════════════════════════════════════════════════════════╗
║  AGENT TASK TEMPLATE VIOLATION - HARD BLOCK                              ║
╚══════════════════════════════════════════════════════════════════════════╝

Reason: ${reason}

Missing Required Fields:
${missingFields.map(f => `  - ${f}`).join('\n')}

YOU MUST USE agent-task.schema.json TEMPLATE FORMAT:

See: .claude/schemas/agent-task.schema.json
Template: .claude/templates/agent-task-template.json
Guide: .claude/docs/AGENT_TASK_TEMPLATE_GUIDE.md

Required Format (JSON structure):
{
  "task_id": "unique-task-identifier",
  "objective": "Clear, single-sentence objective",
  "context": {
    "problem": "What problem are we solving?",
    "why_now": "Why is this urgent?",
    "related_files": ["file1.mjs", "file2.md"]
  },
  "deliverables": [
    {
      "type": "file",
      "path": ".claude/context/reports/task-report.md",
      "description": "What to create",
      "format": "markdown",
      "validation": "How to verify success"
    }
  ],
  "constraints": {
    "max_time_minutes": 30,
    "max_file_reads": 10,
    "must_validate": true
  },
  "success_criteria": ["Criterion 1", "Criterion 2"],
  "verification": {
    "verification_type": "runtime",
    "required_tests": [
      {
        "test_name": "Test Name",
        "command_or_action": "npm test",
        "expected_outcome": "All tests pass"
      }
    ],
    "passing_criteria": {
      "errors_allowed": 0,
      "tests_passed_minimum": "100%"
    },
    "evidence_required": true
  },
  "assigned_agent": "developer"
}

OPTIMIZATION FIELDS (Research-Backed - 30-60% reliability improvement):
  - reasoning_style: "step-by-step" (25-35% fewer hallucinations)
  - examples: [1-5 few-shot examples] (30-60% reliability boost)
  - uncertainty_permission: true (eliminates false confidence)
  - output_format: {structure: "xml-tagged", sections: [...]}
  - thinking_budget: 1000 (prevents premature conclusions)
  - validation_schema: {JSON schema} (30-60% reliability boost)

Benefits of Structured Format:
  ✅ 30-60% reliability improvement (validated against research)
  ✅ 25-35% fewer hallucinations (clear constraints + uncertainty permission)
  ✅ Consistent agent outputs (standardized deliverables)
  ✅ Auto-validation (validation_schema field)
  ✅ Reproducible results (examples field)

❌ INCORRECT: Freeform text prompts ("implement feature X")
❌ INCORRECT: Partial JSON (missing required fields)
✅ CORRECT: Use full JSON template with all required fields
`;

  if (missingOptimizations && missingOptimizations.length > 0) {
    message += `\n
⚠️  MISSING OPTIMIZATION FIELDS (recommended for best results):
${missingOptimizations.map(f => `  - ${f}`).join('\n')}
`;
  }

  return message;
}

/**
 * Main hook execution
 */
async function main() {
  try {
    const input = await readInput();

    if (!input) {
      // No input, allow by default
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }

    if (input.error) {
      // Input parsing error, allow (don't block on hook errors)
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }

    const { tool_name, tool_input } = input;

    // Only validate Task tool calls
    if (tool_name !== 'Task') {
      console.log(JSON.stringify({ decision: 'approve' }));
      return;
    }

    // Validate task template
    const validationResult = validateTaskTemplate(tool_input);

    if (!validationResult.valid) {
      // Block invalid task calls
      const blockMessage = generateBlockMessage(validationResult);
      console.log(
        JSON.stringify({
          decision: 'block',
          reason: blockMessage,
          missing_fields: validationResult.missingFields || [],
          missing_optimizations: validationResult.missingOptimizations || [],
          has_optimizations: false,
          error: validationResult.error || null,
        })
      );
      return;
    }

    // Allow valid task calls
    console.log(
      JSON.stringify({
        decision: 'approve',
        missing_fields: [],
        missing_optimizations: validationResult.missingOptimizations || [],
        has_optimizations: validationResult.hasOptimizations === true,
      })
    );

    // Log warning if missing optimizations
    if (validationResult.missingOptimizations.length > 0) {
      console.error(
        `⚠️  Task template missing optimization fields: ${validationResult.missingOptimizations.join(', ')}`
      );
    }
  } catch (error) {
    // Never block on hook errors (fail-safe)
    console.error(`Hook error: ${error.message}`);
    console.log(JSON.stringify({ decision: 'approve' }));
  }
}

// Export for testing
export { validateTaskTemplate, generateBlockMessage, extractTaskPrompt };

// Run if executed directly (cross-platform check)
const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url === `file:///${process.argv[1]}` ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')));

if (isMainModule) {
  main();
}

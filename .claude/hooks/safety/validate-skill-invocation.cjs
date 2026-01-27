'use strict';

/**
 * Skill Invocation Validation Hook
 *
 * Ensures agents properly use Skill() tool to invoke skills,
 * rather than just Read()ing the SKILL.md files.
 */

const SKILL_PATH_PATTERN = /\.claude[\/\\]skills[\/\\][^\/\\]+[\/\\]SKILL\.md/i;

/**
 * Check if a path is a skill file
 * @param {string} filePath - The file path to check
 * @returns {boolean}
 */
function isSkillFile(filePath) {
  return SKILL_PATH_PATTERN.test(filePath);
}

/**
 * Extract skill name from file path
 * @param {string} filePath - The file path to extract from
 * @returns {string|null}
 */
function extractSkillName(filePath) {
  const match = filePath.match(/skills[\/\\]([^\/\\]+)[\/\\]/i);
  return match ? match[1] : null;
}

/**
 * Validate hook - called before Read operations
 * @param {Object} context - Hook context with tool info
 * @param {string} context.tool - The tool name being invoked
 * @param {Object} context.parameters - The tool parameters
 * @returns {{ valid: boolean, error: string, warning?: string }}
 */
function validate(context) {
  const { tool, parameters } = context;

  // Only check Read operations
  if (tool !== 'Read') {
    return { valid: true, error: '' };
  }

  const filePath = parameters?.file_path || '';

  // Check if reading a SKILL.md file
  if (!isSkillFile(filePath)) {
    return { valid: true, error: '' };
  }

  // Extract skill name from path
  const skillName = extractSkillName(filePath) || 'unknown';

  // Return warning (not blocking - reading is allowed but may indicate improper usage)
  return {
    valid: true,
    error: '',
    warning: `REMINDER: You are reading skill file directly. To properly invoke this skill, use: Skill({ skill: "${skillName}" }). Reading is allowed for reference, but Skill() tool applies the workflow.`,
  };
}

/**
 * Parse hook input from Claude Code.
 * Input comes as JSON via stdin.
 *
 * @returns {Promise<object|null>} Parsed hook context or null
 */
async function parseHookInput() {
  // Try command line argument first (older hook format)
  if (process.argv[2]) {
    try {
      return JSON.parse(process.argv[2]);
    } catch (e) {
      // Not valid JSON, try stdin
    }
  }

  // Read from stdin (current hook format)
  return new Promise(resolve => {
    let input = '';
    let hasData = false;

    // Set encoding for proper text handling
    process.stdin.setEncoding('utf8');

    // Handle stdin data
    process.stdin.on('data', chunk => {
      hasData = true;
      input += chunk;
    });

    // Handle end of input
    process.stdin.on('end', () => {
      if (!hasData || !input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (e) {
        // Invalid JSON
        resolve(null);
      }
    });

    // Handle errors
    process.stdin.on('error', () => {
      resolve(null);
    });

    // Set a timeout in case stdin never ends
    setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, 100);

    // Resume stdin if it was paused
    process.stdin.resume();
  });
}

/**
 * Main execution function.
 * Runs when hook is invoked by Claude Code.
 */
async function main() {
  try {
    // Parse the hook input
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // No input provided - fail open
      process.exit(0);
    }

    // Verify this is a Read tool call
    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Read') {
      // Not a Read tool - allow
      process.exit(0);
    }

    // Extract file path
    const toolInput = hookInput.tool_input || hookInput.input || {};
    const filePath = toolInput.file_path || '';

    // Check if this is a skill file
    if (!isSkillFile(filePath)) {
      // Not a skill file - allow without warning
      process.exit(0);
    }

    // Extract skill name
    const skillName = extractSkillName(filePath) || 'unknown';

    // Return warning (exit 0 but with message) about using Skill() tool instead
    console.log(
      JSON.stringify({
        result: 'warn',
        message: `Consider using Skill({ skill: "${skillName}" }) instead of reading SKILL.md directly. Reading is allowed for reference, but Skill() tool applies the workflow.`,
      })
    );
    process.exit(0);
  } catch (err) {
    // On any error, fail open to avoid blocking legitimate work
    if (process.env.DEBUG_HOOKS) {
      console.error('Skill invocation validator error:', err.message);
    }
    process.exit(0);
  }
}

// Run main function when executed directly
if (require.main === module) {
  main();
}

module.exports = {
  validate,
  isSkillFile,
  extractSkillName,
  parseHookInput,
  main,
  SKILL_PATH_PATTERN,
};

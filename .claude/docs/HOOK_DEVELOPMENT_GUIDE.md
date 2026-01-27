# Hook Development Guide

A comprehensive guide for creating, testing, and deploying hooks in the Claude Code Enterprise Framework.

## Overview

Hooks are event handlers that execute at specific points in the Claude Code lifecycle. They provide:

- **Validation**: Block dangerous commands before execution
- **Transformation**: Modify inputs before processing
- **Recording**: Extract and persist insights after operations
- **Enforcement**: Ensure agents follow architectural rules

## Hook Architecture

```
User/Agent Action
       |
       v
+----------------+
|  Hook Event    |  (UserPromptSubmit, PreToolUse, PostToolUse, SessionEnd)
+----------------+
       |
       v
+----------------+
|  Hook Matcher  |  (Bash, Edit|Write, Task, etc.)
+----------------+
       |
       v
+----------------+
|  Hook Script   |  (.cjs file)
+----------------+
       |
  +----+----+
  |         |
exit(0)   exit(2)
Allow     Block
```

### Event Types

| Event              | When It Fires        | Common Uses                             |
| ------------------ | -------------------- | --------------------------------------- |
| `UserPromptSubmit` | User sends message   | Router analysis, session context reset  |
| `PreToolUse`       | Before tool executes | Command validation, routing enforcement |
| `PostToolUse`      | After tool executes  | Memory extraction, format enforcement   |
| `SessionEnd`       | Session ends         | Persist session insights                |

## Exit Code Conventions

Exit codes determine how Claude Code responds to hook execution:

| Exit Code | Meaning    | Behavior                                               |
| --------- | ---------- | ------------------------------------------------------ |
| `0`       | Pass/Allow | Operation proceeds normally                            |
| `1`       | Error      | Hook encountered an error (logged, operation proceeds) |
| `2`       | Block      | Operation is blocked with error message                |

### Critical: Exit Code 2 for Blocking

Exit code `2` is the ONLY way to block an operation. Example:

```javascript
// Block a dangerous command
if (isDangerous) {
  console.log('BLOCKED: Dangerous command detected');
  process.exit(2); // This blocks the operation
}
```

## Shared Utilities Reference

### hook-input.cjs (Pattern - not a shared file)

Standard pattern for parsing hook input from Claude Code:

```javascript
/**
 * Parse hook input from Claude Code.
 * Input comes as JSON via stdin or command line argument.
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

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      hasData = true;
      input += chunk;
    });

    process.stdin.on('end', () => {
      if (!hasData || !input.trim()) {
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(input));
      } catch (e) {
        resolve(null);
      }
    });

    process.stdin.on('error', () => resolve(null));

    setTimeout(() => {
      if (!hasData) resolve(null);
    }, 100);

    process.stdin.resume();
  });
}
```

### safe-json.cjs

Location: `.claude/lib/utils/safe-json.cjs`

Provides safe JSON parsing with schema validation to prevent prototype pollution.

```javascript
const { safeParseJSON, safeReadJSON, SCHEMAS } = require('../../lib/utils/safe-json.cjs');

// Parse JSON string with schema validation
const state = safeParseJSON(jsonString, 'router-state');

// Read and parse JSON file with schema validation
const state = safeReadJSON('/path/to/file.json', 'router-state');
```

**Available Schemas**:

- `router-state`: Router mode and complexity tracking
- `loop-state`: Loop prevention state
- `evolution-state`: Self-evolution state tracking

### atomic-write.cjs

Location: `.claude/lib/utils/atomic-write.cjs`

Provides atomic file writes to prevent data corruption on crash.

```javascript
const { atomicWriteSync, atomicWriteJSONSync } = require('../../lib/utils/atomic-write.cjs');

// Write text content atomically
atomicWriteSync('/path/to/file.txt', 'content');

// Write JSON with pretty printing
atomicWriteJSONSync('/path/to/state.json', { mode: 'agent' });
```

### state-cache.cjs

Location: `.claude/lib/utils/state-cache.cjs`

TTL-based caching layer for state files to reduce redundant file I/O.

```javascript
const {
  getCachedState,
  invalidateCache,
  clearAllCache,
} = require('../../lib/utils/state-cache.cjs');

// Read with caching (1 second TTL default)
const state = getCachedState('/path/to/router-state.json', {});

// Custom TTL (5 seconds)
const state = getCachedState('/path/to/file.json', {}, 5000);

// Invalidate after writing
invalidateCache('/path/to/router-state.json');

// Clear all cached data
clearAllCache();
```

### project-root.cjs

Location: `.claude/lib/utils/project-root.cjs`

Finds the project root directory containing `.claude/CLAUDE.md`.

```javascript
const { findProjectRoot, PROJECT_ROOT } = require('../../lib/utils/project-root.cjs');

// Get project root
const root = findProjectRoot();
// or use cached constant
const root = PROJECT_ROOT;
```

## Testing Patterns

### Unit Testing Structure

Create test files alongside hook files with `.test.cjs` extension:

```
.claude/hooks/routing/
├── task-create-guard.cjs
├── task-create-guard.test.cjs
├── router-state.cjs
└── router-state.test.cjs
```

### Test File Template

```javascript
#!/usr/bin/env node
/**
 * Tests for hook-name.cjs
 */

'use strict';

const assert = require('assert');
const path = require('path');

// Import the module under test
const { validate, extractCommand } = require('./hook-name.cjs');

/**
 * Run all tests
 */
async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Basic validation
  try {
    const result = validate({ command: 'safe-command' });
    assert.strictEqual(result.valid, true, 'Safe command should pass');
    passed++;
  } catch (e) {
    console.error('Test 1 FAILED:', e.message);
    failed++;
  }

  // Test 2: Dangerous command blocked
  try {
    const result = validate({ command: 'dangerous-command' });
    assert.strictEqual(result.valid, false, 'Dangerous command should fail');
    assert.ok(result.error, 'Should have error message');
    passed++;
  } catch (e) {
    console.error('Test 2 FAILED:', e.message);
    failed++;
  }

  // Test 3: Edge case handling
  try {
    const result = validate(null);
    assert.strictEqual(result.valid, true, 'Null input should pass (fail-open)');
    passed++;
  } catch (e) {
    console.error('Test 3 FAILED:', e.message);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
```

### Running Tests

```bash
# Run individual test
node .claude/hooks/routing/task-create-guard.test.cjs

# Run all hook tests
find .claude/hooks -name "*.test.cjs" -exec node {} \;
```

### Mock stdin for Testing

```javascript
/**
 * Test with simulated stdin
 */
async function testWithStdin(hookPath, input) {
  const { spawn } = require('child_process');

  return new Promise((resolve, reject) => {
    const proc = spawn('node', [hookPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data;
    });
    proc.stderr.on('data', data => {
      stderr += data;
    });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);

    // Write input to stdin
    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
```

## Security Requirements

### Fail-Closed Principle

**Security-critical hooks MUST fail closed** (exit 2) on errors:

```javascript
async function main() {
  try {
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // SEC-008 FIX: Fail closed when no input available
      console.error(
        JSON.stringify({
          hook: 'hook-name',
          event: 'no_input_fail_closed',
          timestamp: new Date().toISOString(),
          reason: 'No hook input provided - failing closed for security',
        })
      );
      process.exit(2); // BLOCK, not allow
    }

    // Validation logic...
  } catch (err) {
    // SEC-008 FIX: Fail closed on errors (defense-in-depth)
    console.error(
      JSON.stringify({
        hook: 'hook-name',
        event: 'error_fail_closed',
        error: err.message,
        timestamp: new Date().toISOString(),
      })
    );
    process.exit(2); // BLOCK, not allow
  }
}
```

### Fail-Open Override

For debugging, provide environment variable override:

```javascript
// Allow fail-open for debugging only
if (process.env.HOOK_NAME_FAIL_OPEN === 'true') {
  console.error(
    JSON.stringify({
      hook: 'hook-name',
      event: 'fail_open_override',
      error: err.message,
      timestamp: new Date().toISOString(),
    })
  );
  process.exit(0);
}
```

### Audit Logging

Log all security-relevant events:

```javascript
// Log security override usage
console.error(
  JSON.stringify({
    hook: 'hook-name',
    event: 'security_override_used',
    override: 'ENFORCEMENT_VAR=off',
    timestamp: new Date().toISOString(),
    warning: 'Security enforcement disabled',
  })
);
```

### Prototype Pollution Prevention

Always use safe JSON parsing for external input:

```javascript
const { safeParseJSON } = require('../../lib/utils/safe-json.cjs');

// WRONG: Direct JSON.parse is vulnerable
const data = JSON.parse(untrustedInput);

// CORRECT: Use safe parsing with schema validation
const data = safeParseJSON(untrustedInput, 'router-state');
```

## Hook Type Examples

### PreToolUse Validation Hook

```javascript
#!/usr/bin/env node
/**
 * Example PreToolUse Validation Hook
 *
 * Validates commands before execution.
 *
 * Exit codes:
 * - 0: Allow operation
 * - 2: Block operation (dangerous command)
 */

'use strict';

async function parseHookInput() {
  // ... (standard parsing logic)
}

function validateCommand(command) {
  // Check for dangerous patterns
  const dangerousPatterns = [
    /rm\s+-rf\s+\/$/,
    /sudo\s+/,
    /:(){:|:&};:/, // Fork bomb
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { valid: false, error: `Dangerous pattern detected: ${pattern}` };
    }
  }

  return { valid: true };
}

async function main() {
  try {
    const hookInput = await parseHookInput();

    if (!hookInput) {
      // Fail closed for security
      process.exit(2);
    }

    const toolName = hookInput.tool_name || hookInput.tool;
    if (toolName !== 'Bash') {
      process.exit(0);
    }

    const toolInput = hookInput.tool_input || hookInput.input || {};
    const command = toolInput.command;

    if (!command) {
      process.exit(0);
    }

    const result = validateCommand(command);

    if (!result.valid) {
      console.log(`BLOCKED: ${result.error}`);
      process.exit(2);
    }

    process.exit(0);
  } catch (err) {
    console.error('Hook error:', err.message);
    process.exit(2); // Fail closed
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateCommand };
```

### PostToolUse Recording Hook

```javascript
#!/usr/bin/env node
/**
 * Example PostToolUse Recording Hook
 *
 * Records information after tool execution.
 *
 * Exit codes:
 * - 0: Always (recording hooks should not block)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteJSONSync } = require('../../lib/utils/atomic-write.cjs');

async function parseHookInput() {
  // ... (standard parsing logic)
}

function recordToolUse(hookInput) {
  const toolName = hookInput.tool_name || hookInput.tool;
  const toolInput = hookInput.tool_input || hookInput.input || {};
  const toolResult = hookInput.tool_result || {};

  const record = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    input: toolInput,
    result: toolResult,
  };

  // Append to log file
  const logPath = path.join(__dirname, '../../context/runtime/tool-log.json');

  let log = [];
  try {
    if (fs.existsSync(logPath)) {
      log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
  } catch (e) {
    log = [];
  }

  log.push(record);
  atomicWriteJSONSync(logPath, log);
}

async function main() {
  try {
    const hookInput = await parseHookInput();

    if (!hookInput) {
      process.exit(0); // Fail open for recording hooks
    }

    recordToolUse(hookInput);
    process.exit(0);
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error('Recording hook error:', err.message);
    }
    process.exit(0); // Fail open
  }
}

if (require.main === module) {
  main();
}
```

### UserPromptSubmit State Reset Hook

```javascript
#!/usr/bin/env node
/**
 * Example UserPromptSubmit Hook
 *
 * Resets state at the start of each prompt cycle.
 */

'use strict';

const routerState = require('./router-state.cjs');

async function main() {
  try {
    // Reset to router mode at start of new prompt
    routerState.resetToRouterMode();
    process.exit(0);
  } catch (err) {
    if (process.env.DEBUG_HOOKS) {
      console.error('State reset error:', err.message);
    }
    process.exit(0); // Fail open for state management
  }
}

if (require.main === module) {
  main();
}
```

## Hook Registration

Register hooks in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/safety/your-hook.cjs" }]
      }
    ]
  }
}
```

### Matcher Patterns

| Pattern                       | Matches                 |
| ----------------------------- | ----------------------- |
| `""`                          | All tools               |
| `"Bash"`                      | Bash tool only          |
| `"Edit\|Write"`               | Edit OR Write tools     |
| `"Edit\|Write\|NotebookEdit"` | Multiple specific tools |

## Enforcement Modes

Standard enforcement modes for security hooks:

| Mode    | Behavior                             | Environment Variable       |
| ------- | ------------------------------------ | -------------------------- |
| `block` | Stops execution with error (exit 2)  | Default for security hooks |
| `warn`  | Logs warning, allows action (exit 0) | Development/testing        |
| `off`   | Silent pass-through                  | Debugging only             |

Example implementation:

```javascript
const enforcement = process.env.MY_HOOK_ENFORCEMENT || 'block';

if (enforcement === 'off') {
  // Log override usage for audit
  console.error(
    JSON.stringify({
      hook: 'my-hook',
      event: 'security_override_used',
      override: 'MY_HOOK_ENFORCEMENT=off',
      timestamp: new Date().toISOString(),
    })
  );
  process.exit(0);
}

// ... validation logic ...

if (!isValid) {
  if (enforcement === 'block') {
    console.log(JSON.stringify({ result: 'block', message: errorMessage }));
    process.exit(2);
  } else {
    // warn mode
    console.log(JSON.stringify({ result: 'warn', message: errorMessage }));
    process.exit(0);
  }
}
```

## Best Practices

### Do

1. **Use shared utilities** for JSON parsing, file writing, and caching
2. **Implement audit logging** for all security-relevant events
3. **Create tests** alongside hook files
4. **Document exit codes** in file header comments
5. **Use environment variables** for enforcement mode overrides
6. **Fail closed** for security-critical hooks

### Do Not

1. **Never use raw `JSON.parse`** on untrusted input
2. **Never fail open** on security-critical hooks without override flag
3. **Never block** operations in recording/memory hooks
4. **Never ignore** stdin parsing errors in security hooks
5. **Never hardcode** file paths - use `findProjectRoot()`

## Debugging

Enable verbose logging:

```bash
DEBUG_HOOKS=true claude
```

Override enforcement for testing:

```bash
MY_HOOK_ENFORCEMENT=warn claude
```

## References

- **Hooks Reference**: `.claude/docs/HOOKS_REFERENCE.md`
- **Security Validators**: `.claude/docs/SECURITY_VALIDATORS.md`
- **Router Protocol**: `.claude/docs/ROUTER_PROTOCOL.md`
- **Hook Creator Skill**: `.claude/skills/hook-creator/SKILL.md`

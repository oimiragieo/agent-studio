#!/usr/bin/env node
/**
 * Skill Tester - Test Claude Code skills for correctness
 *
 * Usage:
 *   node test.cjs <skill-path> [options]
 *
 * Options:
 *   --validate          Run structure validation (default: true)
 *   --introspect        Test executor --list (for MCP-converted skills)
 *   --call <tool>       Test calling a specific tool
 *   --args <json>       Arguments for tool call (default: minimal valid args)
 *   --timeout <ms>      Timeout for executor tests (default: 30000)
 *   --json              Output as JSON
 *
 * Examples:
 *   node test.cjs .claude/skills/sequential-thinking
 *   node test.cjs .claude/skills/sequential-thinking --introspect
 *   node test.cjs .claude/skills/sequential-thinking --call sequentialthinking
 */

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { validateSkill } = require("./validate.cjs");

const DEFAULT_TIMEOUT = 30000;

function parseArgs(argv) {
  const args = {
    skillPath: null,
    validate: true,
    introspect: false,
    call: null,
    callArgs: null,
    timeout: DEFAULT_TIMEOUT,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--validate") args.validate = true;
    else if (token === "--no-validate") args.validate = false;
    else if (token === "--introspect") args.introspect = true;
    else if (token === "--call") args.call = argv[++i];
    else if (token === "--args") args.callArgs = argv[++i];
    else if (token === "--timeout") args.timeout = parseInt(argv[++i], 10);
    else if (token === "--json") args.json = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else if (!token.startsWith("-") && !args.skillPath) args.skillPath = token;
  }

  return args;
}

function usage(exitCode = 0) {
  console.log(`
Skill Tester - Test Claude Code skills for correctness

Usage:
  node test.cjs <skill-path> [options]

Options:
  --validate          Run structure validation (default: true)
  --no-validate       Skip structure validation
  --introspect        Test executor --list (for MCP-converted skills)
  --call <tool>       Test calling a specific tool
  --args <json>       Arguments for tool call
  --timeout <ms>      Timeout for executor tests (default: 30000)
  --json              Output as JSON
  --help              Show this help

Examples:
  node test.cjs .claude/skills/sequential-thinking
  node test.cjs .claude/skills/sequential-thinking --introspect
  node test.cjs .claude/skills/sequential-thinking --introspect --call sequentialthinking
`);
  process.exit(exitCode);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const cwd = options.cwd || process.cwd();

    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function testValidation(skillPath) {
  const result = validateSkill(skillPath, { strict: false });
  return {
    test: "validation",
    passed: result.valid,
    errors: result.errors,
    warnings: result.warnings,
    name: result.name,
  };
}

async function testIntrospection(skillPath, timeout) {
  const executorPath = path.join(skillPath, "executor.py");

  if (!fs.existsSync(executorPath)) {
    return {
      test: "introspection",
      passed: false,
      skipped: true,
      reason: "No executor.py found (not an MCP-converted skill)",
    };
  }

  try {
    const result = await runCommand("python", ["executor.py", "--list"], {
      cwd: skillPath,
      timeout,
    });

    // Check if output contains valid JSON array
    const output = result.stdout.trim();
    const jsonStart = output.indexOf("[");
    const jsonEnd = output.lastIndexOf("]");

    if (jsonStart === -1 || jsonEnd === -1) {
      return {
        test: "introspection",
        passed: false,
        error: "No JSON array in output",
        stdout: output.slice(0, 500),
        stderr: result.stderr.slice(0, 500),
      };
    }

    const jsonStr = output.slice(jsonStart, jsonEnd + 1);
    const tools = JSON.parse(jsonStr);

    if (!Array.isArray(tools)) {
      return {
        test: "introspection",
        passed: false,
        error: "Output is not an array",
      };
    }

    return {
      test: "introspection",
      passed: true,
      toolCount: tools.length,
      tools: tools.map((t) => t.name),
    };
  } catch (e) {
    return {
      test: "introspection",
      passed: false,
      error: e.message,
    };
  }
}

async function testToolCall(skillPath, toolName, toolArgs, timeout) {
  const executorPath = path.join(skillPath, "executor.py");

  if (!fs.existsSync(executorPath)) {
    return {
      test: "tool_call",
      tool: toolName,
      passed: false,
      skipped: true,
      reason: "No executor.py found",
    };
  }

  // If no args provided, try to get minimal args from introspection
  let argsJson = toolArgs || "{}";

  try {
    const result = await runCommand(
      "python",
      ["executor.py", "--tool", toolName, "--args", `'${argsJson}'`],
      { cwd: skillPath, timeout }
    );

    // Check for success indicators
    const output = result.stdout.trim();
    const hasJsonOutput = output.includes('"content"') || output.includes('"isError"');
    const isError = output.includes('"isError": true') || result.code !== 0;

    // Look for JSON result
    const jsonStart = output.lastIndexOf("{");
    const jsonEnd = output.lastIndexOf("}");

    let parsedResult = null;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      try {
        parsedResult = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (parsedResult && parsedResult.isError === false) {
      return {
        test: "tool_call",
        tool: toolName,
        passed: true,
        result: parsedResult,
      };
    }

    if (hasJsonOutput && !isError) {
      return {
        test: "tool_call",
        tool: toolName,
        passed: true,
        output: output.slice(-500),
      };
    }

    return {
      test: "tool_call",
      tool: toolName,
      passed: false,
      error: result.stderr || "Tool call failed",
      exitCode: result.code,
      stdout: output.slice(-500),
    };
  } catch (e) {
    return {
      test: "tool_call",
      tool: toolName,
      passed: false,
      error: e.message,
    };
  }
}

async function runTests(skillPath, options) {
  const results = {
    skill: path.basename(skillPath),
    path: path.resolve(skillPath),
    tests: [],
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  };

  // Test 1: Validation
  if (options.validate) {
    const validationResult = await testValidation(skillPath);
    results.tests.push(validationResult);
    results.summary.total++;
    if (validationResult.passed) results.summary.passed++;
    else results.summary.failed++;
  }

  // Test 2: Introspection
  if (options.introspect) {
    const introspectResult = await testIntrospection(skillPath, options.timeout);
    results.tests.push(introspectResult);
    results.summary.total++;
    if (introspectResult.skipped) results.summary.skipped++;
    else if (introspectResult.passed) results.summary.passed++;
    else results.summary.failed++;
  }

  // Test 3: Tool Call
  if (options.call) {
    const callResult = await testToolCall(
      skillPath,
      options.call,
      options.callArgs,
      options.timeout
    );
    results.tests.push(callResult);
    results.summary.total++;
    if (callResult.skipped) results.summary.skipped++;
    else if (callResult.passed) results.summary.passed++;
    else results.summary.failed++;
  }

  results.allPassed = results.summary.failed === 0;
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) usage(0);
  if (!args.skillPath) {
    console.error("[ERROR] Skill path is required");
    usage(1);
  }

  // If no specific tests requested beyond validation, also do introspection
  if (!args.introspect && !args.call && fs.existsSync(path.join(args.skillPath, "executor.py"))) {
    args.introspect = true;
  }

  try {
    const results = await runTests(args.skillPath, args);

    if (args.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(`\nTesting skill: ${results.skill}`);
      console.log(`Path: ${results.path}\n`);

      for (const test of results.tests) {
        const icon = test.skipped ? "⊘" : test.passed ? "✓" : "✗";
        const status = test.skipped ? "SKIP" : test.passed ? "PASS" : "FAIL";

        console.log(`[${icon}] ${test.test.toUpperCase()}: ${status}`);

        if (test.errors && test.errors.length > 0) {
          test.errors.forEach((e) => console.log(`    Error: ${e}`));
        }
        if (test.warnings && test.warnings.length > 0) {
          test.warnings.forEach((w) => console.log(`    Warning: ${w}`));
        }
        if (test.toolCount !== undefined) {
          console.log(`    Tools found: ${test.toolCount} (${test.tools.join(", ")})`);
        }
        if (test.error && !test.passed) {
          console.log(`    Error: ${test.error}`);
        }
        if (test.reason) {
          console.log(`    Reason: ${test.reason}`);
        }
      }

      console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} passed`);
      if (results.summary.skipped > 0) {
        console.log(`         ${results.summary.skipped} skipped`);
      }

      if (results.allPassed) {
        console.log("\n[OK] All tests passed");
      } else {
        console.log("\n[FAIL] Some tests failed");
      }
    }

    process.exit(results.allPassed ? 0 : 1);
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exit(1);
  }
}

main();
